# !/bin/bash

# eg1. bash create_workloads.sh -a message
# eg2. bash create_workloads.sh -a stackTrace -r 25 -t 2
# eg3. bash create_workloads.sh -a inventory -m "add-get-hide" -r 25 -t 2 -v true
# eg4. bash create_workloads.sh -a message -m "post-get,post-get-get,post,post" -r 10 -t 4
# eg5. bash create_workloads.sh -a inventory -m "add-get-unhide" -r "5,10,3,4,7" -t 5 -v false
# eg6. bash create_workloads.sh -a inventory -m "add-get,add-hide-get,add-get-hide" -r "5,10,3" -t 3

help() {
cat << EOF
Usage:
    -a required ... application name: message/stackTrace/inventory
    -m default="post-get" ... request type list (methods): post/get/add/update/hide/unhide/list
    -r default=10 ... request number: > 0
    -t default=3 ... thread number: > 0
    -v optional ... visibility (message/inventory): true/false/other value=random
    -o optional ... workload name
EOF
}

while getopts a:m:r:t:v:o: flag
do
    case "${flag}" in
        a) APP=${OPTARG};;
		m) REQTYPES=${OPTARG};;
        r) REQNO=${OPTARG};;
        t) THREADNO=${OPTARG};;
		v) VISIBLE=${OPTARG};;
	o) WNAME=${OPTARG};;
        ? ) help ;;
    esac
done

# application name is required
if [ -z $APP ]; then
    echo "APP: $APP"
    help
    exit -1
fi
# request type list is set to "post-get" by default
if [ -z $REQTYPES ]; then
    REQTYPES="post-get"
fi
# request number is set to 10 by default
if [ -z $REQNO ]; then
    REQNO="10"
fi
# thread number is set to 3 by default
if [ -z $THREADNO ]; then
    THREADNO="3"
fi

cd $KAR_HOME/src/scripts/create_workloads

# base directories
SCRIPTSDIR="./scripts"
WORKLOADSDIR="../../workloads"
if [ ! -d $WORKLOADSDIR ]; then
	mkdir $WORKLOADSDIR
fi

# make the directory for the apps
APPDIR="$WORKLOADSDIR/$APP"
if [ ! -d $APPDIR ]; then
    mkdir $APPDIR
fi

# make the directory for the workloads
if [ -z $WNAME ]; then
	WNAME="$REQTYPES"_"$REQNO"_"$THREADNO"
fi

OUTPUTDIR="$APPDIR/$WNAME"

if [ ! -d $OUTPUTDIR ]; then
	mkdir $OUTPUTDIR
fi

# run python script
if [ -z $VISIBLE ]; then
    python $SCRIPTSDIR/generator.py -a $APP -m $REQTYPES -r $REQNO -t $THREADNO -d $OUTPUTDIR
else
    python $SCRIPTSDIR/generator.py -a $APP -m $REQTYPES -r $REQNO -t $THREADNO -d $OUTPUTDIR -v $VISIBLE
fi


