import * as log from "https://deno.land/std@0.141.0/log/mod.ts";

export function resetTenant(hostname) {
    fetch(`http://${hostname}/~/resettenant`).then((response)=>{
        const result = response.text();
        log.info(result);
    })
    return 'Reseting tenant...';
}