MLS-ADMIN project overview
=================================

The goal of this project is to create a comprehensive and modern server to handle various operations with Real Estate MLS database:

- A (ExpressJS) server that automatically fetches new updates in the MLS database and pushes them into our database (within intervals, say every 4 hours)


- Saving the logs of each fetch in the database to be accessed by admin pages (MongoDB)


- Offering a CLI that the user can manually fetch new updates and see the reports for this fetch and previous ones (to be written using the *commander package*)


- Offering a (basic) web console that the user can manually fetch new updates and see the reports for this fetch and previous ones (to be written using *react*)


The existing code
--------------------
Our existing code for this project is very crude and manual. Our goal is to make it into a mature open source tool, to be used by anyone working on a real estate project. It consists of two separate tools in fact:

1. A fetcher (in folder */fetcher*) which fetches new updates from the MLS database. For now it saves the data of each fetch in the folder `/data/fetch-<id>` (`<id>` is the fetch id, which is just a number).
   >>The credential used in this code are *test credentials* and the data is not real data, yet please do your best to keep it secret.


2. The pusher (/pusher), which pushed the data fetched by the fetcher (from its folder within /data) into mongodb database. It also organizes the (messy) MLS data into a better format and adds geocode data to properties as well (using google geocoder) . Many names (such as the name of the collection for each property type) are hard-coded which have to be replaced gradually with variables and settings, etc.


MLS database
-----------------
It is provided by real estate boards of each area. We are using the one for Vancouver area. Our current MLS access provides us with four types of property:

- type "ra" (residential attached, like condo/townhouse)
- type "rd" (residential detached, like house)
- type "ml" (multi-family)
- type "ld" (land)


The version we are using is called RETS. There is no clear-and-cut get-started tutorial for using RETS, though you can find the ooficial manual at [this link](https://www.reso.org/rets-specifications/) (not sure which RETS version applies to ours, I once used the manual for version 1.7 ...) The only practical guide I had was a php file by the name of *RETS.PHP* given to us by the vancouver real estate board (by [this link](http://members.rebgv.org/rets/)) and it demonstrates how to connect to their RET and fetch different types of data. I refactored the code and created a more organized version with three php files as you can see in the /fetcher folder. But we need to convert them all into NodeJS first in order to combine it with the pusher tool, and eventually into a full-fledged ExpressJS server.


Onboarding Task
---------------------
Take a look at the starter file [RETS.PHP](http://members.rebgv.org/rets/RETS.txt). No need to understand its RETS class and all the details, just see how they fetch the data, etc. Then checkout my /fetcher folder (particularly data-fetcher.php) to see how I use the class RETS for fetching MLS data. Get a general sense.


Tools
------------------------
We use the [latest version of Node](https://nodejs.org/en/). For the Node package manager we use [Yarn](https://classic.yarnpkg.com/en/docs/cli/) instead of NPM. To brush-up with Node checkout [its documentation](https://nodejs.org/api/documentation.html). TO search and find useful Node packages checkout [npm repo](https://www.npmjs.com/). To install Mongodb follow [this guide](https://docs.mongodb.com/manual/installation/) (use community edition of course, and select your platform). For using MongoDB in Node check [this](http://mongodb.github.io/node-mongodb-native/3.6/api/index.html) out.

>>We prefer that everyone uses Ubuntu18, or at least a version of Linux. We really discourage using Windows for development though.

