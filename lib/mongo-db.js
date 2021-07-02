
const {MongoClient} = require('mongodb');

const {_defaults} = require("@pinglue/toolbox");

class MongoDb {

    constructor(settings) {
        this.settings = settings;

        _defaults(this.settings, {
            host: "localhost",
            port: "27017",
            "db-name": "pinglueDB"
        });
    }

    async connect() {

        // building connection string
        let upStr = "";
        if (this.settings.username && this.settings.password)
            upStr = `${this.settings.username}:${this.settings.password}@`;

        let conStr = `mongodb://${upStr}${this.settings["host"]}:${this.settings["port"]}/${this.settings["db-name"]}`;

        try {
            // connecting
            const client = new MongoClient(conStr, this.settings["driver-options"]);            
            await client.connect();

            // get the db object
            this.db = client.db(this.settings["db-name"]);            
            console.log("Connection to MongoDB was successfull");
            this.client = client;
            return true;

        } catch (err) {
            console.log("Connection to MongoDB failed!", err);
            return false;
        }
    }

    async close() {
        if (this.client) await this.client.close();
    }

    getCol(name) {
        if (!this.db) return null;
        return this.db.collection(name);
    }
}

module.exports = MongoDb;