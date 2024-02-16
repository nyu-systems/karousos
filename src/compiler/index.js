const {
    compileAllFiles,
    compileOnlyRequired
} = require('./compile_functions.js')
const onlyRequiredFlag = "--onlyRequired"

//first two arguments are not relevant
var args = process.argv.slice(2);

var startTime, endTime;

//check if the only requires flag exists
var onlyRequired = false;

if (args.includes(onlyRequiredFlag)) {
    onlyRequired = true;
    args.splice(args.indexOf(onlyRequiredFlag), 1);
}
//check that the arguments are ok
checkArguments(args);

//convert verifierMode from string to boolean
var verifierMode = args[2] == 'true';

var input = args[0];
var output = args[1];

//start timer
start()
//compile the files and print any error that might occur
try {
    if (!onlyRequired) {
        compileAllFiles(input, output, verifierMode, args.slice(3))
    } else {
        compileOnlyRequired(input, output, verifierMode, args.slice(3))
    }
} catch (err) {
    console.log(err)
}
//end timer
end()

//The following functions are used to measure the time
//it takes to compile
function start() {
    startTime = new Date();
};

//prints how much time has elapsed since start() was called
function end() {
    endTime = new Date();
    var timeDiff = endTime - startTime; //in ms
    // strip the ms
    timeDiff /= 1000;

    // get seconds
    var seconds = Math.round(timeDiff);
    console.log(seconds + " seconds");
}

function checkArguments(args) {
    if (args.length < 3 || !(['true', 'false']).includes(args[2])) {
        throw new Error('Usage:\n' +
            'node compiler input output verifierMode [ignoreFiles] \n' +
            'verifierMode should be true or false\n' +
            'optional flag: [' + onlyRequiredFlag + '])')
    }
}