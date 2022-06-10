import * as log from "https://deno.land/std@0.142.0/log/mod.ts";
import { config } from "https://deno.land/std@0.142.0/dotenv/mod.ts";
import { parse } from "https://deno.land/std@0.142.0/flags/mod.ts";
import { runServer } from "file://C:/_GreenAntSolutions/Repositories/JSphereServer/jsphere/server.ts"

const rootName = Deno.cwd().replaceAll('\\', '/').split('/').pop();
if (rootName != 'JSphereProjects') {
    log.error('The JSphere CLI can only run within a JSphereProjects directory.');
    Deno.exit(0);
}

const cliConfig = {
    currentProject: '',
    currentConfig: {}
}

let cmdLine;
let promptText = 'JSPHERE>';
while (cmdLine = prompt(promptText)) {
    const cmdArgs = parse(cmdLine.split(' '));
    try {
        switch (cmdArgs._[0]) {
            case 'checkout': await processCheckoutCmd(cmdArgs); break;
            case 'create': await processCreateCmd(cmdArgs); break;
            case 'quit': await processQuitCmd(cmdArgs); break;
            case 'reset': await processResetCmd(cmdArgs); break;
            case 'run': await processRunCmd(cmdArgs); break;
            case 'use': await processUseCmd(cmdArgs); break;
            default: log.error(`Command '${cmdArgs._[0] || ""}' not recognized.`);
        }
    }
    catch (e) {
        log.critical(e.message);
    }
}

// CHECKOUT
async function processCheckoutCmd(cmdArgs) {
    try {
        if (cliConfig.currentProject) {
            const project = cliConfig.currentProject;
            const provider = cliConfig.currentConfig.REMOTE_HOST;
            const owner = cliConfig.currentConfig.REMOTE_ROOT;
            const accessToken = cliConfig.currentConfig.REMOTE_AUTH;
            const repo = cliConfig.currentConfig.REMOTE_CONFIG;
            if (cmdArgs._[1].startsWith('.')) {
                await cloneRepo({ project, provider, owner, accessToken, repo });
            }
            else {
                const parts = cmdArgs._[1].split('/');
                const appName = parts[0];
                const appPackage = parts[1];
                const appFile = await Deno.readFile(`${cliConfig.currentProject}/${repo}/.applications/${appName}.json`);
                const appConfig = JSON.parse(new TextDecoder().decode(appFile));
                if (appConfig.packages && appConfig.packages[appPackage]) {
                    await cloneRepo({
                        project,
                        provider: appConfig.host.name,
                        owner: appConfig.host.root,
                        accessToken: appConfig.host.auth,
                        repo: appPackage
                    });
                }
                else {
                    log.error(`The application '${appName}' does not have the package '${appPackage}' registered.`);
                }
            }
        }
        else log.error('This command is only valid within a project.')
    }
    catch (e) {
        log.critical(e.message);
    }
}

// CREATE
async function processCreateCmd(cmdArgs) {
    switch (cmdArgs._[1]) {
        case 'package': await processCreatePackageCmd(cmdArgs); break;
        case 'project': await processCreateProjectCmd(cmdArgs); break;
    }
}

// CREATE PACKAGE
async function processCreatePackageCmd(cmdArgs) {
    const packageName = cmdArgs._[2];
    if (cliConfig.currentProject) {
        if (packageName) {
            await Deno.mkdir(`${cliConfig.currentProject}/${packageName}/client`, { recursive: true });
            await Deno.mkdir(`${cliConfig.currentProject}/${packageName}/server`, { recursive: true });
            await initRepo({ project: cliConfig.currentProject, repo: packageName });
        }
        else log.error(`Please provide a package name.`);
    }
    else log.error('This command is only valid within a project.')
}

// CREATE PROJECT
async function processCreateProjectCmd(cmdArgs) {
    const projectName = cmdArgs._[2];
    if (projectName) {
        await Deno.mkdir(`${projectName}`, { recursive: true });    
        const envSettings = {
            useLocalConfig: 'true',
            localRoot: projectName,
            localConfig: '.jsphere'
        }
        await Deno.writeFile(`${projectName}/.env`, (new TextEncoder).encode(getEnvContent(envSettings)));
        if (cmdArgs.init) {
            await Deno.mkdir(`${projectName}/.jsphere`, { recursive: true });    
            await Deno.writeFile(`${projectName}/.jsphere/server.json`, (new TextEncoder).encode('{}'));
            await Deno.mkdir(`${projectName}/.jsphere/.tenants`, { recursive: true });    
            await Deno.writeFile(`${projectName}/.jsphere/.tenants/localhost.json`, (new TextEncoder).encode(getTenantContent()));
            await Deno.mkdir(`${projectName}/.jsphere/.applications`, { recursive: true });
            await Deno.writeFile(`${projectName}/.jsphere/.applications/app.json`, (new TextEncoder).encode(getApplicationContent()));
            await Deno.mkdir(`${projectName}/app/client`, { recursive: true });    
            await Deno.writeFile(`${projectName}/app/client/index.html`, (new TextEncoder).encode(getClientIndexContent()));
            await Deno.mkdir(`${projectName}/app/server`, { recursive: true });    
            await Deno.writeFile(`${projectName}/app/server/index.ts`, (new TextEncoder).encode(getServerIndexContent()));
            await initRepo({ project: cliConfig.currentProject, repo: '.jsphere' });
            await initRepo({ project: cliConfig.currentProject, repo: 'app' });
        }
        await processUseCmd({ _: [ 'use', projectName ] });
    }
    else log.error(`Please provide a project name.`);
}

// QUIT
async function processQuitCmd(cmdArgs) {
    Deno.exit(0);
}

// RESET TENANT
async function processResetCmd(cmdArgs) {
    const tenant = cmdArgs._[1];
    if (tenant) {
        const response = await fetch(`http://${tenant}/~/resettenant`);
        const result = await response.text();
        log.info(result);
    }
    else {
        log.error(`Please provide a tenant domain.`);
    }
}

// RUN
async function processRunCmd(cmdArgs) {
    //Deno.chdir(`${Deno.cwd()}/${cliConfig.currentProject}`);
    await runServer(`./${cliConfig.currentProject}/.env`);
}

// USE
async function processUseCmd(cmdArgs) {
    if (cmdArgs._[1] === undefined) {
        cliConfig.currentProject = '';
        promptText = `JSPHERE>`;
        return;
    }

    const projectName = cmdArgs._[1].toLowerCase();
    const dirEntries = Deno.readDirSync(Deno.cwd());
    let found = false;
    
    for (let entry of dirEntries) {
        if (entry.isDirectory && entry.name.toLowerCase() == projectName) {
            cliConfig.currentProject = entry.name;
            cliConfig.currentConfig = await config({ path: `./${projectName}/.env`});
            promptText = `JSPHERE:${entry.name}>`;
            found = true;
        }
    }
    if (!found) {
        log.error(`The project '${cmdArgs._[1]}' does not exist.`)
    }
}

// ********************* UTILITY FUNCTIONS *********************

async function cloneRepo(config) {
    // todo: If GitHub/Bitbucket
    let process;
    const path = `./${config.project}/${config.repo}`;
    if (config.accessToken) {
        process = Deno.run({ 
            cmd: ['git', 'clone', `https://${config.owner}:${config.accessToken}@github.com/${config.owner}/${config.repo}.git`, path],
        });
    }
    else {
        process = Deno.run({ 
            cmd: ['git', 'clone', `https://github.com/${config.owner}/${config.repo}.git`, path],
        });
    }
    await process.status();
    process.close();
}

async function initRepo(config) {
    let process;
    const path = `./${config.project}/${config.repo}`;
    process = Deno.run({ 
        cmd: ['git', 'init', path],
    });
    await process.status();
    process.close();
}

// ********************* CONTENT TEMPLATES *********************

function getEnvContent(envSettings) {
    const content = `USE_LOCAL_CONFIG=${envSettings.uselocalConfig || ''}

LOCAL_CONFIG=${envSettings.localConfig || ''}
LOCAL_ROOT=${envSettings.localRoot || ''}
    
REMOTE_CONFIG=${envSettings.remoteConfig || ''}
REMOTE_HOST=${envSettings.remoteHost || ''}
REMOTE_ROOT=${envSettings.remoteRoot || ''}
REMOTE_AUTH=${envSettings.remoteAuth || ''}

SERVER_HTTP_PORT=80
`;
    return content;
}

function getTenantContent() {
    const content = `{
    "application": "app",
    "appSettings": {
    },
    "contextExtensions": {
    }
}
`;
    return content;
}

function getApplicationContent() {
    const content = `{
    "host": {
        "name": "FileSystem",
        "root": "",
        "auth": ""
    },
    "packages": {
        "app": {
        }
    },
    "routeMappings": [
    ],
    "appSettings": {
    }
}
`;
    return content;
}

function getClientIndexContent() {
    const content = `<html>
    <head>
        <script>
            fetch('/app/server/index/message')
                .then((response) => response.text())
                .then((data) => document.body.innerHTML = data)
        </script>
    </head>
    <body>
    </body>
</html>
`;
    return content;
}

function getServerIndexContent() {
    const content = `export async function message(ctx: any) : Promise<any> {
    return ctx.response.text('Hello JSphere');
}
message.attributes = { method: 'GET' };
`;
    return content;
}

