export const volunteerShiftSchema = {
    type: "object",
    properties: {
        shiftId: { type: "string" },
        date: { type: "string", format: "date-time" },
        maxVolunteers: { type: "number" },
        volunteers: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    name: { type: "string" },
                    email: { type: "string" }
                },
                required: ["name", "email"]
            }
        },
        hours: { type: "number" }
    },
    required: ["shiftId", "date", "maxVolunteers", "volunteers", "hours"]
};
