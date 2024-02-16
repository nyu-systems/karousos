# !/bin/bash

help() {
cat << EOF
Usage:
    -a required ... application name: message/stackTrace/inventory
    -r default=10 ... request number: > 0
    -t default=3 ... thread number: > 0
    -P default=50 ... probability of post requests: (0,100]
    -L default=0 ... probability of list requests: [0,100]
    -U default=0 ... probability of update requests: [0,100]
    -I default=1 ... number of inserts in the case of stackTrace
    -v optional ... visibility (message/inventory): true/false/other_value=random
    -o optional ... file to write the workload at
EOF
}

#In the case of inventory the probability of an insert/update requst = P 
#Probability of update request | insert/update request = U
while getopts a:r:t:P:L:U:v:I:o: flag
do
    case "${flag}" in
        a) APP=${OPTARG};;
        r) REQNO=${OPTARG};;
        t) THREADNO=${OPTARG};;
        P) PROB_POST=${OPTARG};;
        L) PROB_LIST=${OPTARG};;
        U) PROB_UPD=${OPTARG};;
	v) VISIBLE=${OPTARG};;
	I) INSERTS=${OPTARG};;
	o) OUTPUTDIR=${OPTARG};;
        ? ) help ;;
    esac
done

# application name is required
if [ -z $APP ]; then
	echo "APP: $APP"
	help
	exit -1
fi

if [ -z $PROB_POST ]; then
	echo "Set to 50"
	PROB_POST="50"
fi
if [ -z $PROB_LIST ]; then
	PROB_LIST="0"
fi
if [ -z $PROB_UPD ]; then
	PROB_UPD="0"
fi
if [ -z $INSERTS ]; then
	INSERTS="1"
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

if [ -z $OUTPUTDIR ]; then
	# make the directory for the workloads
	OUTPUTDIR="$APPDIR/post-$PROB_POST"_"list-$PROB_LIST"_"$REQNO"_"$THREADNO"
	if [ "$APP" == "inventory" ]; then
		OUTPUTDIR="$APPDIR/post-$PROB_POST"_"update-$PROB_UPD"_"$REQNO"_"$THREADNO"
	fi

	if [ "$APP" == "stackTrace" ]; then
		OUTPUTDIR="$APPDIR/post-$PROB_POST"_"list-$PROB_LIST"_"inserts-$INSERTS"_"$REQNO"_"$THREADNO"
	fi
else
	OUTPUTDIR="$APPDIR/$OUTPUTDIR"
fi

if [ ! -d $OUTPUTDIR ]; then
	mkdir $OUTPUTDIR
fi

# run python script
if [ -z $VISIBLE ]; then
    python $SCRIPTSDIR/generator_probability.py -a $APP -r $REQNO -t $THREADNO -pP $PROB_POST -pL $PROB_LIST -pU $PROB_UPD -I $INSERTS -d $OUTPUTDIR
else
    python $SCRIPTSDIR/generator_probability.py -a $APP -r $REQNO -t $THREADNO -pP $PROB_POST -pL $PROB_LIST -pU $PROB_UPD -I $INSERTS -d $OUTPUTDIR -v $VISIBLE
fi


