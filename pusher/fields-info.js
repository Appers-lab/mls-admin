const fs = require("fs").promises;
const {_for, _asyncFor, _defaults} = require("@pinglue/toolbox");

const FieldManager = require("../lib/field-manager");
const settings = require("./settings");

const fieldMgr = new FieldManager(settings.general);


(async ()=> {


    await fieldMgr.load();

    await _asyncFor (settings.general.classes, async className => {
        console.log("generating report for class",className);
        let report = fieldMgr.getBriefInfo(className);
        await fs.writeFile(`${settings.general.metaDir}/fields-${className}.csv`, report, "utf8");
    });
    


    //let info = fieldMgr.getBriefInfo("ra");

    //console.log(info);

    //console.log(settings.general.metaDir);

})();
