const uuid = require("uuid")

const NumOfThread =10;
const NumOfReq = 60; //requests per thread

let postComment=15, addPage=25, renderPage=60;// set the % for example 15,25,60
const uids=getUids(NumOfThread,NumOfReq)
//console.log(uids);
const requestGroups =[];


generateTrace();
//console.log(requestGroups)

function generateTrace(){
    for(let i=0;i<NumOfThread;i++)  prepare(i)
}

//prepare request for a specific thread
function prepare(gno){
    requestGroups[gno]=[]
    let pageIndex =0;
    for(let i=0;i<NumOfReq;i++){
        //the first request is always adding a page
        if(i===0) {
            requestGroups[gno][0]= addPageReq(i)
            continue;
        }
        requestGroups[gno][i]= dice(i)
    }

    function addPageReq(i){
        return toString(gno*NumOfReq+i+1,"addPage",uids[gno][pageIndex++]);
    }

    function renderPageReq(i){
        let pageNo = Math.floor(Math.random() * pageIndex)
        return toString(gno*NumOfReq+i+1,"getPage",uids[gno][pageNo]);
    }

    function postCommentReq(i){
        return toString(gno*NumOfReq+i+1,"postComment","");
    }
    //randomly add a request
    function dice(i){
        let sum= postComment+addPage+renderPage;
        let dice =Math.floor(Math.random() * sum)
        if(dice<postComment)    return postCommentReq(i)
        if(dice>sum-renderPage) return renderPageReq(i)
        return addPageReq(i)
    }
}



//generate unique ids for pages
function getUids(thn,rqn){
    result=[];
    for(let i=0;i<thn;i++) result[i]=[];

    for(let i=0;i<thn;i++)
    for(let j=0;j<rqn;j++)
    result[i][j]=uuid.v4();
    return result;
}


function toString(...args){
    return args.reduce((e,i)=>e+","+i , "").slice(1)
}

module.exports={
    NumOfThread,
    requestGroups,
}
