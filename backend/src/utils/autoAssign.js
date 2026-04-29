'use strict';

const db = require('../config/database');

/**
 * Auto-assign algorithm:
 * 1. Fetch all clinic_staff with status = 'available'
 * 2. Filter by staff_availability for bookedDate day-of-week & time window
 * 3. Cross-check no existing bookings conflict (with 15-min buffer)
 * 4. Sort by rating DESC, then experience_years DESC
 * 5. Return top candidate
 *
 * @param {Object} opts - { clinicId, bookedDate, bookedTime, durationMinutes }
 * @returns {Object|null} clinic_staff record or null if none available
 */
async function autoAssignTherapist({ clinicId, bookedDate, bookedTime, durationMinutes }) {
  const dow = new Date(bookedDate).getDay(); // 0 = Sunday
  const bufferMinutes = 15;

  // Step 1 & 2: Available staff with a matching day-of-week schedule slot
  const { rows: candidates } = await db.query(
    `SELECT cs.id, cs.user_id, cs.rating, cs.experience_years,
            sa.start_time, sa.end_time
     FROM clinic_staff cs
     JOIN staff_availability sa ON sa.staff_id = cs.id
     WHERE cs.clinic_id = $1
       AND cs.status = 'available'
       AND sa.day_of_week = $2
       AND sa.is_active = true
       AND sa.start_time <= $3::time
       AND sa.end_time   >= ($3::time + ($4 || ' minutes')::interval)`,
    [clinicId, dow, bookedTime, durationMinutes]
  );

  if (!candidates.length) return null;

  // Step 3: Cross-check for booking conflicts (include 15-min buffer)
  const available = [];
  for (const staff of candidates) {
    const { rows: conflicts } = await db.query(
      `SELECT id FROM bookings
       WHERE therapist_id = $1
         AND booked_date = $2
         AND status NOT IN ('cancelled', 'refund_requested')
         AND (
           booked_time < ($3::time + (($4 + $5) || ' minutes')::interval)
           AND (booked_time + (duration_minutes || ' minutes')::interval) > ($3::time - ($5 || ' minutes')::interval)
         )`,
      [staff.id, bookedDate, bookedTime, durationMinutes, bufferMinutes]
    );
    if (!conflicts.length) {
      available.push(staff);
    }
  }

  if (!available.length) return null;

  // Step 4: Sort by rating DESC, then experience_years DESC
  available.sort((a, b) => {
    const ratingDiff = parseFloat(b.rating) - parseFloat(a.rating);
    if (ratingDiff !== 0) return ratingDiff;
    return b.experience_years - a.experience_years;
  });

  return available[0]; // Step 5: Top result
}

module.exports = { autoAssignTherapist };
