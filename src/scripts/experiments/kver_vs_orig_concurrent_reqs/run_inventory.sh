#!/bin/bash
export i=1;
export RECORD_HLOG=1

for req_no in 10 50 100
do
	#Mixed
	export KEEP_ALIVE_FOR=25000
	export KEEP_ALIVE_FOR_SERVER=25000

	#../../create_workloads/create_workloads_probability.sh -a inventory -r $req_no -t $i -P 50 -U 50 -v true
	workload="post-50_update-50_"$req_no"_$i"

	./run_workload.sh inventory $workload

	sleep 10s


	#Write-heavy workload

	#../../create_workloads/create_workloads_probability.sh -a inventory -r $req_no -t $i -P 90 -U 50 -v true
	workload="post-90_update-50_"$req_no"_$i"

	./run_workload.sh inventory $workload

	sleep 10s

	#Read-heavy workload

	#../../create_workloads/create_workloads_probability.sh -a inventory -r $req_no -t $i -P 10 -U 50 -v true
	workload="post-10_update-50_"$req_no"_$i"

	./run_workload.sh inventory $workload

	sleep 10s
done
