import sys, os
import argparse
import math
from sequence_per_thread import *
from utils import *

message_fields = ["RID", "REQUEST TYPE", "DATE", "MESSAGE", "READABLE"]
stackTrace_fields = ["RID", "REQUEST TYPE", "HASH", "VALUE"]
inventory_fields = ["RID", "REQUEST TYPE", "ID TYPE", "QUANTITY", "VISIBLE"]
two_arg_micro_fields = ["RID", "TOTAL", "k"];
one_arg_micro_fields = ["RID", "TOTAL"];

if __name__ == "__main__":
	parser = argparse.ArgumentParser(description='argparse')
	parser.add_argument('-a', '--app', help='application', required=True)
	parser.add_argument('-r', '--req_no', help='request number', required=True)
	parser.add_argument('-t', '--thread_no', type=int, help='thread number', required=True)
	parser.add_argument('-d', '--output_dir', help='output directory', required=True)
	parser.add_argument('-m', '--req_type_list', help='a list of request types (methods): "post-get-etc."', required=True)
	parser.add_argument('-v', '--visibility', help='visibility (message/inventory): true/false/other value=random', required=False)
	args = parser.parse_args()


	# get thread number
	thread_no = args.thread_no
	if thread_no <= 0:
		print("ERROR: thread number should be positive")
		sys.exit(-1)

	# get request numbers
	req_no_list = [int(item) for item in args.req_no.split(",")]
	if not req_no_list:
		print("ERROR: provide request numbers")
		sys.exit(-1)
	else:
		req_n = len(req_no_list)

		if req_n == 1 and thread_no > 1:
			# all threads have the same number of requests
			for j in range(thread_no-1):
				req_no_list.append(req_no_list[0])
		else:
			# user defined request number for each thread
			if req_n == thread_no:
				for item in req_no_list:
					if item <= 0:
						print("ERROR: request number should be positive")
						sys.exit(-1)
			else:
				print("ERROR: provide a request number for every thread")
				sys.exit(-1)

	# get the user defined sequence(s) of req types
	if args.req_type_list:
		req_type_seqs = args.req_type_list.split(",")
		type_n = len(req_type_seqs)
		for i in range(type_n):
			req_type_seqs[i] = req_type_seqs[i].split("-")
		
		if type_n == 1 and thread_no > 1:
			# all threads have the same request type sequence
			for j in range(thread_no-1):
				req_type_seqs.append(req_type_seqs[0])
		else:
			# user defined request type sequence for each thread
			if type_n != thread_no:
				print("ERROR: provide a sequence of request types for every thread")
				sys.exit(-1)
	else:
		print("random")
		sys.exit(0)

	# get readable/visible value for message/inventory
	visibility = args.visibility
	if visibility != "true" and visibility != "false":
		visibility = ""

	for tid in range(1, thread_no+1):
		# the number of requests already generated
		offset = sum(req_no_list[ : tid-1])

		if args.app == "message":
			workloads = message_generator(tid, offset, req_no_list[tid-1], req_type_seqs[tid-1], visibility)
			write_workloads(os.path.join(args.output_dir, "t"+str(tid)+".csv"), message_fields, workloads)
		elif args.app == "stackTrace":
			workloads = stackTrace_generator(tid, offset, req_no_list[tid-1], req_type_seqs[tid-1])
			write_workloads(os.path.join(args.output_dir, "t"+str(tid)+".csv"), stackTrace_fields, workloads)
		elif args.app == "inventory":
			workloads = inventory_generator(tid, offset, req_no_list[tid-1], req_type_seqs[tid-1], visibility)
			write_workloads(os.path.join(args.output_dir, "t"+str(tid)+".csv"), inventory_fields, workloads)
		elif args.app == "delay_first_write_micro" or args.app == "delay_first_write_micro_det" or args.app == "vary_writes_micro" or args.app == "vary_handler_width_micro" or args.app == "simulate_io_micro":
			workloads = two_arg_micro_generator(tid, offset, req_no_list[tid-1], req_type_seqs[tid-1])
			write_workloads(os.path.join(args.output_dir, "t"+str(tid)+".csv"), two_arg_micro_fields, workloads)
		elif args.app == "concurrent_handlers_micro" or args.app == "vary_handler_depth_micro":
			workloads = one_arg_micro_generator(tid, offset, req_no_list[tid-1], req_type_seqs[tid-1])
			write_workloads(os.path.join(args.output_dir, "t"+str(tid)+".csv"), one_arg_micro_fields, workloads)
		else:
			print("ERROR: unknown application")
			sys.exit(-1)
