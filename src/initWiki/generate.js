const info = require('./trace')
const threadNo = info.NumOfThread;
const trace = info.requestGroups;
var fs = require('fs');
const path = require('path')

const workloadDir = path.join(__dirname,"../workloads/wiki/mix10")
fs.mkdir(workloadDir,(e)=>{
    for(let i=0;i<threadNo;i++){
        let content=toString(trace[i]);
        fs.writeFile(path.join(workloadDir,"t"+(i+1)+".csv"),content,(err)=>{
            if (err) throw err;
            console.log(content);
        })
    }
    console.log(toString(trace[0]))

})
function toString(arr){
    return 'RID,reqType,dt\n'+arr.reduce((line,ini)=>line+ini+'\n',"")
}
