
const fs = require("fs").promises;
const {_for, _asyncFor, _defaults, print} = require("@pinglue/toolbox");

const FieldManager = require("../lib/field-manager");
const MongoDb = require("../lib/mongo-db");
const settings = require("./settings");
const geocoder = require("../lib/geocoder");

const fieldMgr = new FieldManager(settings.general);
const mongoDb = new MongoDb(settings.dbInfo);

const DATA_DIR = settings.general.dataDir;


async function patchGeo() {

    print(`Patching the db\n`, "header");

    const count = {};

    //let flag = true;

    for (let className of settings.general.classes) {

        print(`Patching collection "properties-${className}"`);

        let col = mongoDb.getCol(`properties-${className}`);
        let c = col.find({});

        while(await c.hasNext()) {
            let p = await c.next();

            print(`Patching doc _id: ${p["_id"]}`, "==>");

            if (!p["lat"] || !p["long"]) {
                print(" (No lat\\long) ", "mute");
                print("@done");
                continue;
            }

            let geometry = {
                type: "Point",
                coordinates: [p["long"], p["lat"]]
            }

            print(" (updating the doc) ", "mute");
            await col.updateOne({_id:p["_id"]}, {$set: {geometry}});
            print("@done");
        }
    }
}


async function push(fetchId, options) {
    
    print(`Pushing the fetch "${fetchId}"\n`, "header");

    const count = {};

    //let flag = true;

    for(let className of settings.general.classes) {

        count[className] = {total:0, geoCodingFailed:0};
        let col = mongoDb.getCol(`properties-${className}`);
        let filename = `${DATA_DIR}/fetch-${fetchId}/${className}.json`;

        try {
            let temp = await fs.readFile(filename, {encoding:"utf8"});
            let data = JSON.parse(temp);

            await _asyncFor(data, async row => {
                //if (flag) flag = false;
                //else return;

                count[className].total++;
                let rowConverted = convert(row, className);
                let _id = rowConverted["_id"];
                print(`[class ${className}]: Proceesing property "${_id}"`, "...");

                let geoFailed = true;
                if (!options.noGeocoding) {
                    print("Geocoding", "==>");
                    let geo = await geocoder(getAddrStr(rowConverted));
                    if (!geo.success) {
                        print("@failed");
                        count[className].geoCodingFailed++;
                    }
                    else {
                        geoFailed = false;
                        print("@done");

                        //rowConverted["lat"] = geo.lat;
                        //rowConverted["long"] = geo.long;

                        rowConverted["geometry"] = {
                            type: "Point",
                            coordinates: [geo.long, geo.lat]
                        };
                    }

                }

                print("Pushing to DB", "==>");
                if (options.updateGeo) {
                    if (!geoFailed) {
                        print(" (updating the geometry field) ", "mute");
                        await col.updateOne({_id}, {$set: {geometry: rowConverted["geometry"]}});
                    }
                    else
                        print(" (No update to commit) ", "mute");
                }
                else {
                    await col.replaceOne({_id}, rowConverted, {upsert:true});
                }
                print("@done");
            });
            
        } catch (err) {
            console.log(`Error:`, err);
            return;
        }
    }

    print("\n\n Stats\n====================\n", "header");
    _for(count, (info, className) => {
        print(`For class "${className}", total ${info.total} - Failed geo: ${info.geoCodingFailed}\n`);
    });

}

/*async function testGeo() {
    let filename = `${DATA_DIR}/fetch-2/ra.json`;
    let temp = await fs.readFile(filename, {encoding:"utf8"});
    let data = JSON.parse(temp);

    //console.log(data[0]);

    let row = data[0];
    let rowConverted = convert(row, "ra");


    let cityLookups = fieldMgr.getLookups("ra", "City");
    //console.log(lookups);
    let city = cityLookups[rowConverted["City"]]["LongValue"];

    let addStr = `${rowConverted["Address"]}, ${city}, ${rowConverted["Province"]}, ${rowConverted["PostalCode"]}`;

    console.log(`Geocoding address "${addStr}" ...`);

    let res = await geocoder(addStr);

    console.log("Response is", res);
}*/

function getAddrStr(rowConverted) {
    let cityLookups = fieldMgr.getLookups("ra", "City");
    let city = cityLookups[rowConverted["City"]]["LongValue"];
    return `${rowConverted["Address"]}, ${city}, ${rowConverted["Province"]}, ${rowConverted["PostalCode"]}`;
}

function convert(row, className) {

    let dbName = fieldMgr.getDBNames(className);

    let row2 = {};
    _for(row, (val, key)=>{
        row2[dbName[key]] = val;
    });

    /*
    fields categories:

        1. ("Interpretation":"LookupMulti") => make into array by split("'");
        2. numeric:
            DataType in ["Tiny", "Small", "Int", "Long", "Decimal"]
            Interpretation in ["Number", "Currency"]
            Precision is non empty
        3. String: everything otehr than 1,2
    */

    let row3 = {};

    _for(row2, (value, key) => {

        if (!value) return;

        key = String(key);

        if (key == "SystemID") {
            row3["_id"] = Number(value);
            return;
        }

        // clustering rooms info
        let found = key.match(/^Room(\d+)(\w+)$/);
        if (found) {
            let index = found[1];
            let fn = found[2];
            _defaults(row3, {Rooms:{[index]:{[fn]:value}}});
            return;
        }

        // clustering baths info
        found = key.match(/^Bath(\d+)(\w+)$/);
        if (found) {
            let index = found[1];
            let fn = found[2];
            _defaults(row3, {Baths:{[index]:{[fn]:value}}});
            return;
        }
        found = key.match(/^Bth(\d+)Ensuit$/);
        if (found) {
            let index = found[1];            
            _defaults(row3, {Baths:{[index]:{Ensuit:value}}});
            return;
        }

        // LO fields
        found = key.match(/^LO(\d)(\w+)$/);
        if (found) {
            let index = found[1];
            let fn = found[2];
            _defaults(row3, {ListOffices: {[index]:{[fn]:value}}});
            return;
        }

        // SO fields
        found = key.match(/^SO(\d)(\w+)$/);
        if (found) {
            let index = found[1];
            let fn = found[2];
            _defaults(row3, {SaleOffices: {[index]:{[fn]:value}}});
            return;
        }

        if (fieldMgr.isMultiLookup(className, key)) 
            row3[key] = value.toString().split(",").map(x=>x.toString().trim());

        else if (fieldMgr.isNumber(className, key)) 
            row3[key] = Number(value);

        else row3[key] = String(value);
    });

    // adding photos
    let photoURLs = [];
    for(let i=1;i<=row3["PhotoCount"]; i++) {
        photoURLs.push(`/files/photos-${className}/${row3["_id"]}_${i}.jpg`);
    }
    row3["photos"] = photoURLs;

    //console.log("Processed row3 is", row3);
    return row3;
}

/* Main function
======================= */
(async ()=> {

    await mongoDb.connect();

    await fieldMgr.load();

    // we choose one of the options below
    //await push(2, {updateGeo: true});
    //await testGeo();
    //await patchGeo();


    await mongoDb.close();

})();
