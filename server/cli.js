import * as log from "https://deno.land/std@0.142.0/log/mod.ts";
import { parse } from "https://deno.land/std@0.142.0/flags/mod.ts";
import { runServer } from "file://C:/_GreenAntSolutions/Repositories/JSphereServer/jsphere/server.ts"

const rootName = Deno.cwd().replaceAll('\\', '/').split('/').pop();
if (rootName != 'JSphereProjects') {
    log.error('The JSphere CLI can only run within a JSphereProjects directory.');
    Deno.exit(0);
}

const config = {
    projects: {},
    currentProject: ''
}

let cmdLine;
let promptText = 'JSPHERE>';
while (cmdLine = prompt(promptText)) {
    const cmdArgs = parse(cmdLine.split(' '));
    try {
        switch (cmdArgs._[0]) {
            case 'config': await processConfigCmd(cmdArgs); break;
            case 'create': await processCreateCmd(cmdArgs); break;
            case 'init': await processInitCmd(cmdArgs); break;
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

// CONFIG
async function processConfigCmd(cmdArgs) {
    try {
        if (config.currentProject) {
            if (cmdArgs.username) config[config.currentProject].username = cmdArgs.username;
            if (cmdArgs.accessToken) config[config.currentProject].username = cmdArgs.access-token;
            log.info(`Updated configuration properties.`);
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
    if (config.currentProject) {
        if (packageName) {
            await Deno.mkdir(`${config.currentProject}/${packageName}/client`, { recursive: true });
            await Deno.mkdir(`${config.currentProject}/${packageName}/server`, { recursive: true });
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
            projectHost: 'FileSystem',
            projectRoot: '',
            projectAuth: '',
            projectConfig: '.jsphere'
        }
        await Deno.writeFile(`${projectName}/.env`, (new TextEncoder).encode(getEnvContent(envSettings)));
        await processUseCmd({ _: [ 'use', projectName ] });
        if (cmdArgs.app) {

        }
    }
    else log.error(`Please provide a project name.`);
}

// INIT
async function processInitCmd(cmdArgs) {
    const projectName = config.currentProject;
    if (projectName) {
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
        const envSettings = {
            projectHost: 'FileSystem',
            projectRoot: '',
            projectAuth: '',
            projectConfig: '.jsphere'
        }
        await Deno.writeFile(`${projectName}/.env`, (new TextEncoder).encode(getEnvContent(envSettings)));
        await processUseCmd({ _: [ 'use', projectName ] });
    }
    else log.error('This command is only valid within a project.')
}

// QUIT
async function processQuitCmd(cmdArgs) {
    Deno.exit(0);
}

// RESET TENANT
async function processResetCmd(cmdArgs) {
    const tenant = cmdArgs._[2];
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
    Deno.chdir(`${Deno.cwd()}/${config.currentProject}`);
    await runServer();
}

// USE
async function processUseCmd(cmdArgs) {
    if (cmdArgs._[1] === undefined) {
        config.currentProject = '';
        promptText = `JSPHERE>`;
        return;
    }

    const projectName = cmdArgs._[1].toLowerCase();
    const dirEntries = Deno.readDirSync(Deno.cwd());
    let found = false;
    
    for (let entry of dirEntries) {
        if (entry.isDirectory && entry.name.toLowerCase() == projectName) {
            config.currentProject = entry.name;
            if (!config.projects[entry.name]) config.projects[entry.name] = {};
            promptText = `JSPHERE:${entry.name}>`;
            found = true;
        }
    }
    if (!found) {
        log.error(`The project '${cmdArgs._[1]}' does not exist.`)
    }
}







async function initFromGitHub(projectRoot, projectConfig) {
    const process = Deno.run({ 
        cmd: ['git', 'clone', `https://${config.username}:${config.accessToken}@github.com/${projectRoot}/${projectConfig}.git`],
        stdout: "piped",
        stderr: "piped"
    });

    // copy(process.stdout, Deno.stdout);

    await process.status();
    const { code } = await process.status();

    // Reading the outputs closes their pipes
    const rawOutput = await process.stderrOutput
    const rawError = await process.stderrOutput();
    process.close();
   
    if (code !== 0) {
        const error = new TextDecoder().decode(rawError);
        log.error(error);
    }
    
    await Deno.writeFile(`.env`, (new TextEncoder).encode(getEnvContent()));
    log.info(`Project initialized.`);
}


// ********************* CONTENT TEMPLATES *********************

function getEnvContent(envSettings) {
    const content = `PROJECT_HOST=${envSettings.projectHost}
PROJECT_ROOT=${envSettings.projectRoot}
PROJECT_AUTH=${envSettings.projectAuth}
PROJECT_CONFIG=${envSettings.projectConfig}
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
        "provider": "FileSystem",
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
    return ctx.response.text('JSphere');
}
message.attributes = { method: 'GET' };
`;
    return content;
}

