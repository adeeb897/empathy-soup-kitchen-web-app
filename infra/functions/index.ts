import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { volunteerShiftSchema } from "./schema";
import { validate } from "jsonschema";
import { CosmosClient } from "@azure/cosmos";

const connectionString = process.env["COSMOS_DB_CONNECTION_STRING"];
if (!connectionString) {
    throw new Error("COSMOS_DB_CONNECTION_STRING environment variable is not defined");
}
const client = new CosmosClient(connectionString);
const database = client.database("empathySoupKitchen");
const container = database.container("volunteerShifts");

const validateRequestBody = (body: any) => {
    const validationResult = validate(body, volunteerShiftSchema);
    if (!validationResult.valid) {
        return validationResult.errors.map((e: { stack: any; }) => e.stack);
    }
    return null;
};

const createShift = async (body: any) => {
    const { resource } = await container.items.create(body);
    return resource;
};

const getShifts = async (shiftId?: string, startDate?: string, endDate?: string) => {
    if (shiftId) {
        const { resource } = await container.item(shiftId).read();
        return resource;
    } else {
        let query = "SELECT * from c";
        const parameters = [];

        if (startDate) {
            query += " WHERE c.date >= @startDate";
            parameters.push({ name: "@startDate", value: startDate });
        }

        if (endDate) {
            query += startDate ? " AND" : " WHERE";
            query += " c.date <= @endDate";
            parameters.push({ name: "@endDate", value: endDate });
        }

        const { resources } = await container.items.query({ query, parameters }).fetchAll();
        return resources;
    }
};

const updateShift = async (shiftId: string, body: any) => {
    const { resource } = await container.item(shiftId).replace(body);
    return resource;
};

const deleteShift = async (shiftId: string) => {
    await container.item(shiftId).delete();
};
export async function httpTrigger(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    const method = request.method.toLowerCase();
    const shiftId = request.query.get("shiftId") || undefined;
    const startDate = request.query.get("startDate") || undefined;
    const endDate = request.query.get("endDate") || undefined;

    try {
        switch (method) {
            case "post":
                const postErrors = validateRequestBody(request.body);
                if (postErrors) {
                    return {
                        status: 400,
                        body: postErrors
                    };
                }
                return {
                    status: 201,
                    body: await createShift(request.body)
                };

            case "get":
                return {
                    status: 200,
                    body: await getShifts(shiftId, startDate, endDate)
                };

            case "put":
                if (!shiftId) {
                    return {
                        status: 400,
                        body: "shiftId is required for updating a shift"
                    };
                }
                const putErrors = validateRequestBody(request.body);
                if (putErrors) {
                    return {
                        status: 400,
                        body: putErrors
                    };
                }
                return {
                    status: 200,
                    body: await updateShift(shiftId, request.body)
                };

            case "delete":
                if (!shiftId) {
                    return {
                        status: 400,
                        body: "shiftId is required for deleting a shift"
                    };
                }
                await deleteShift(shiftId);
                return {
                    status: 204,
                    body: null
                };

            default:
                return {
                    status: 405,
                    body: "Method Not Allowed"
                };
        }
    } catch (error) {
        return {
            status: 500,
            body: "Internal Server Error"
        };
    }
};

app.http('httpTrigger1', {
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    authLevel: 'anonymous',
    handler: httpTrigger
});