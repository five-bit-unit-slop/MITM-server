import { patchNetModule } from 'edgewire'; // https://coey.dev/edgewire
patchNetModule();

import { Connection, Request } from 'tedious';

export async function data_to_sql(req, res, env) {
    const connection = new Connection({
    server: env.DB_HOST,
    authentication: {
        type: 'default',
        options: {
        userName: env.DB_USER,
        password: env.DB_PASSWORD,
        },
    },
    options: {
        database: env.DB_NAME,
        port: 1433,
        encrypt: true,
        trustServerCertificate: true,
    },
    });

    return new Promise((resolve) => {
    connection.on('connect', (err) => {
        if (err) {
        resolve(
            new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            }),
        );
        return;
        }

        const request = new Request(
        'SELECT * FROM Users WHERE Id = @id',
        (err, rowCount) => {
            connection.close();
            resolve(new Response(JSON.stringify({ rowCount })));
        },
        );

        request.addParameter('id', 1);
        connection.execSql(request);
    });

    connection.connect();
    });
    }
