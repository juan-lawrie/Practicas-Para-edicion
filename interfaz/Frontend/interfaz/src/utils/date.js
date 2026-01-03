// Shared date formatting helpers for the frontend
// export formatMovementDate to produce: YYYY/MM/DD HH:mm
export function formatMovementDate(dateInput) {
    try {
        if (!dateInput) return '';
        let d;
        if (dateInput instanceof Date) {
            d = dateInput;
        } else if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
            // Date-only string like '2025-11-02' -> create local Date at 00:00 to avoid UTC shift
            const [year, month, day] = dateInput.split('-').map(Number);
            d = new Date(year, month - 1, day);
        } else {
            d = new Date(dateInput);
        }
        if (isNaN(d.getTime())) return String(dateInput);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        return `${y}/${m}/${day} ${hh}:${mm}`;
    } catch (e) {
        return String(dateInput);
    }
}
