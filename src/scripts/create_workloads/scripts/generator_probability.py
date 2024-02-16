import sys, os
import argparse
import math
from sequence_probability import *
from utils import *

message_fields = ["RID", "REQUEST TYPE", "DATE", "MESSAGE", "READABLE"]
stackTrace_fields = ["RID", "REQUEST TYPE", "HASH", "VALUE"]
inventory_fields = ["RID", "REQUEST TYPE", "ID TYPE", "QUANTITY", "VISIBLE"]
message_types = ["post", "get"]
stackTrace_types = ["post", "get", "list"]
inventory_types = ["add", "get", "update", "hide", "unhide"]

if __name__ == "__main__":
	parser = argparse.ArgumentParser(description='argparse')
	parser.add_argument('-a', '--app', help='application', required=True)
	parser.add_argument('-r', '--req_no', help='request number', required=True)
	parser.add_argument('-t', '--thread_no', type=int, help='thread number', required=True)
	parser.add_argument('-pP', '--prob_post', type=float, help='probability of post, x/100', required=True)
	parser.add_argument('-pL', '--prob_list', type=float, help='probability of list, x/100', required=True)
	parser.add_argument('-pU', '--prob_update', type=float, help='probability of update, x/100', required=True)
	parser.add_argument('-I', '--inserts', type=int, help='number of inserts in stackTrace', required=True)
	parser.add_argument('-d', '--output_dir', help='output directory', required=True)
	parser.add_argument('-v', '--visibility', help='visibility (message/inventory): true/false/other value=random', required=False)
	args = parser.parse_args()

	# get thread number
	thread_no = args.thread_no
	if thread_no <= 0:
		print("ERROR: thread number should be positive")
		sys.exit(-1)

	# get request numbers
	req_no = [int(item) for item in args.req_no.split(",")]
	if not req_no:
		print("ERROR: provide request numbers")
		sys.exit(-1)
	else:
		req_n = len(req_no)
		if req_n == 1 and thread_no > 1:
			for j in range(thread_no-1):
				req_no.append(req_no[0])
		else:
			assert(req_n == thread_no)
			for item in req_no:
				if item <= 0:
					print("ERROR: requst number should be positive")
					sys.exit(-1)

	print("reqs", req_no)

	# get readable/visible value for message/inventory
	visibility = args.visibility
	if visibility != "true" and visibility != "false":
		visibility = ""

	# get probability for post
	prob_post = args.prob_post
	if prob_post < 0 or prob_post > 100:
		print("ERROR: 0 <= probability of post <= 100")
		exit(-1)
	#get probablility for list
	prob_list = args.prob_list
	if prob_list !=0 and args.app != "stackTrace":
		print("ERROR: probability of list greater than zero for app that is not stackTrace")
		sys.exit(-1)
	if args.app == "stackTrace" and ( prob_list < 0 or (prob_list + prob_post) > 100 ):
		print("ERROR: given probabilities are not valid")
		sys.exit(-1)
	print("prob", prob_post, prob_list)
	# generate workloads
	for tid in range(1, thread_no+1):
		# the number of requests already generated
		offset = sum(req_no[ : tid-1])
		object_ids = []

		if args.app == "message":
			workloads = message_generator(tid, offset, req_no[tid-1], prob_post, object_ids, visibility)
			write_workloads(os.path.join(args.output_dir, "t"+str(tid)+".csv"), message_fields, workloads)
		elif args.app == "stackTrace":
			workloads = stackTrace_generator(tid, offset, req_no[tid-1], prob_post, prob_list, args.inserts, object_ids)
			write_workloads(os.path.join(args.output_dir, "t"+str(tid)+".csv"), stackTrace_fields, workloads)
		elif args.app == "inventory":
			workloads = inventory_generator(tid, offset, req_no[tid-1], prob_post, args.prob_update, object_ids, visibility)
			write_workloads(os.path.join(args.output_dir, "t"+str(tid)+".csv"), inventory_fields, workloads)
		else:
			print("ERROR: unknown application")
			sys.exit(-1)
