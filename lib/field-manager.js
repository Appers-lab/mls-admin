
const fs = require("fs").promises;

class FieldManager {

    constructor(settings) {
        this.settings = settings;        
        this.info = {};
    }

    async load() {

        for (let className of this.settings.classes) {
            let temp = await fs.readFile(`${this.settings.metaDir}/fields-${className}.json`, {encoding:"utf8"});            
            this.info[className] = JSON.parse(temp);

            // adding clustered fields
            this.info[className].info["RoomLev"] = this.info[className].info["Room1Lev"];
            this.info[className].info["RoomType"] = this.info[className].info["Room1Type"];
            this.info[className].info["RoomDim1"] = this.info[className].info["Room1Dim1"];
            this.info[className].info["RoomDim2"] = this.info[className].info["Room1Dim2"];


            this.info[className].info["BathLev"] = this.info[className].info["Bath1Lev"];
            this.info[className].info["BathNoPcs"] = this.info[className].info["Bath1NoPcs"];

        }
    }

    getInfo(className, fieldName=null) {
        if (!this.settings.classes.includes(className)) return {};
        if (!fieldName)
            return this.info[className].info;
        else 
            return this.info[className].info[fieldName];
    }

    getBriefInfo(className) {
        if (!this.settings.classes.includes(className)) return {};
        let ans = "FIELD, LONG NAME, TYPE, INTERPRETATION\n";

        let info = this.info[className].info;

        _for(info, (value, name) => {
            if (!value) return;
            ans += `${name},${value["LongName"]},${value["DataType"]},${value["Interpretation"]}\n`;
        });

        return ans;

    }

    getLookups(className, fieldName) {
        if (!this.settings.classes.includes(className)) return;

        if (!this.getInfo(className, fieldName)) return;

        return this.getInfo(className, fieldName).lookup;
    }

    getDBNames(className) {
        if (!this.settings.classes.includes(className)) return {};
        return this.info[className].sysToDb;
    }

    isMultiLookup(className, fieldName) {
        if (!this.settings.classes.includes(className)) return false;
        return (this.getInfo(className, fieldName)["Interpretation"] == "LookupMulti");
    }

    isSingleLookup(className, fieldName) {
        if (!this.settings.classes.includes(className)) return false;
        return (this.getInfo(className, fieldName)["Interpretation"] == "Lookup");
    }

    isNumber(className, fieldName) {
        let info = this.getInfo(className, fieldName);
        if (!info) return false;
        return (
            ["Tiny", "Small", "Int", "Long", "Decimal"].includes(info["DataType"]) ||
            info["Precision"] ||
            ["Number", "Currency"].includes(info["Interpretation"])
        );
    }
}

module.exports = FieldManager;