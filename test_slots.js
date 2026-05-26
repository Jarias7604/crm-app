const availability = [{ day: 2, start: '08:00', end: '17:00' }]; // Tuesday (today is Tuesday May 26)
const bookedSlots = [];
const date = '2026-05-26';
const durationMinutes = 45;
const bufferMinutes = 0;

function generateSlots(
    availability,
    bookedSlots,
    date,
    durationMinutes,
    bufferMinutes,
) {
    const d = new Date(date + 'T00:00:00');
    const dayOfWeek = d.getDay();
    const avail = availability.find(a => a.day === dayOfWeek);
    if (!avail) return [];

    const [startH, startM] = avail.start.split(':').map(Number);
    const [endH, endM]     = avail.end.split(':').map(Number);

    const slots = [];
    let cursor = new Date(date + 'T00:00:00');
    cursor.setHours(startH, startM, 0, 0);
    const dayEnd = new Date(date + 'T00:00:00');
    dayEnd.setHours(endH, endM, 0, 0);

    const now = new Date();
    console.log('Now:', now.toString());
    console.log('Cursor start:', cursor.toString());

    while (cursor < dayEnd) {
        const slotEnd = new Date(cursor.getTime() + durationMinutes * 60000);
        if (slotEnd > dayEnd) break;

        // Skip past slots
        if (cursor <= now) {
            console.log(`Filtering out past slot: ${cursor.toLocaleTimeString()} because it is <= now`);
            cursor = new Date(cursor.getTime() + (durationMinutes + bufferMinutes) * 60000);
            continue;
        }

        console.log(`Keeping slot: ${cursor.toLocaleTimeString()}`);
        slots.push(cursor.toISOString());
        cursor = new Date(cursor.getTime() + (durationMinutes + bufferMinutes) * 60000);
    }

    return slots;
}

generateSlots(availability, bookedSlots, date, durationMinutes, bufferMinutes);
