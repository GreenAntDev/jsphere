import * as log from "https://deno.land/std@0.141.0/log/mod.ts";

export async function initProject() {
    try {
        await Deno.mkdir('.jsphere/.servers', { recursive: true });    
        await Deno.writeFile('.jsphere/.servers/default.json', (new TextEncoder).encode('{}'));
        await Deno.mkdir('.jsphere/.tenants', { recursive: true });
        await Deno.writeFile('.jsphere/.tenants/localhost.json', (new TextEncoder).encode(tenantConfig));
        await Deno.mkdir('.jsphere/.applications', { recursive: true });    
        await Deno.writeFile('.jsphere/.applications/main.json', (new TextEncoder).encode(appConfig));
        await Deno.mkdir('app/client', { recursive: true });
        await Deno.writeFile('app/client/index.html', (new TextEncoder).encode(indexHTML));
        await Deno.mkdir('app/server', { recursive: true });
        await Deno.writeFile('app/server/endpoint.ts', (new TextEncoder).encode(apiEndpoint));
        await Deno.writeFile('.env', (new TextEncoder).encode(env));
        return 'OK';
    }
    catch (e) {
        return e.message;
    }
}

export async function resetServer(hostname) {
}

export async function resetTenant(hostname) {
    try  {
        const response = await fetch(`http://${hostname}/~/resettenant`);
        const result = await response.text();
        log.info(result);
        return 'OK';
    }
    catch (e) {
        return e.message;
    }
}

export async function createPackage(name) {

}

const appConfig = `{
    "packages": {
        "app": { "tag": "main", "useLocalRepo": false }
    },
    "routeMappings": [
        { "route": "/api/message", "method": "GET", "path": "/app/server/endpoint/message" }
    ]
}
`;

const tenantConfig = `{
    "application": {
        "name": "main",
        "repo": {
            "provider": "FileSystem",
            "root": "${Deno.cwd().replaceAll('\\', '/')}/"
        }
    }
}
`;

const indexHTML = `<html>
    <head>
        <script>
            fetch('api/message')
                .then((response) => response.text())
                .then((data) => document.body.innerHTML = data)
        </script>
    </head>
    <body>
    </body>
</html
`;

const apiEndpoint = `export async function message(ctx: any) : Promise<any> {
    return ctx.response.text('JSphere');
}
message.attributes = { method: 'GET' };
`;

const env = `REPO_PROVIDER=FileSystem
REPO_ROOT=${Deno.cwd().replaceAll('\\', '/')}/
SERVER_CONFIG=default
`;

