
const fs = require("fs").promises;
const {_for, _asyncFor, _defaults, print} = require("@pinglue/toolbox");

const FieldManager = require("../lib/field-manager");
const settings = require("./settings");

const fieldMgr = new FieldManager(settings.general);

/**
 * lookup format:
 * 
 * filename: lookups-[class].csv
 * fields: [fieldname]:[lookup name]
 */

(async ()=> {


    await fieldMgr.load();

    await _asyncFor (settings.general.classes, async className => {

        print(`Generating dictionary for class ${className} ...\n`);
                
        const info = fieldMgr.getInfo(className);
        const records = ["key, en"];
        const namesSet = new Set();

        _for(info, (value, name) => {
            if (!value) return;
            //ans += `${name},${value["LongName"]},${value["DataType"]},${value["Interpretation"]}\n`;
            print(`Checking field ${name}\n`, "mute");
            const lookups = fieldMgr.getLookups(className, name);
            if (!lookups) return;   

            // clustering rooms info
            let found = name.match(/^Room(\d+)(\w+)$/);
            if (found) name = "Rooms:"+found[2];

            // clustering baths info
            found = name.match(/^Bath(\d+)(\w+)$/);
            if (found) name = "Baths:"+found[2];
            found = name.match(/^Bth(\d+)Ensui/);
            if (found) name = "Baths:Ensuit";

            // LO fields
            found = name.match(/^LO(\d)(\w+)$/);
            if (found) name = "ListOffices:"+found[2];

            // SO fields
            found = name.match(/^SO(\d)(\w+)$/);
            if (found) name = "SaleOffices:"+found[2];

            if (namesSet.has(name)) return;
            else namesSet.add(name);
            
            _for(lookups, (lInfo, lookup) => {
                let record = `${name}:${lookup}, ${lInfo["LongValue"]}`;
                //print(record+"\n");
                records.push(record);
            });
        });

        const report = records.join("\n");

        //console.log(report);

        await fs.writeFile(`${settings.general.metaDir}/lookups-${className}.csv`, report, "utf8");
    });

})();
