import sys,os
import string
import random
from utils import *

# user defined req types

def message_generator(tid, offset, t_req_no, req_types, visibility):
	workloads = []
	# generate >= 1 blocks of req types
	while i < t_req_no:
		index = i + 1
		date = None

		# if visibility is not defined, set it randomly
		if not visibility:
			readable = "true"
			remainder = random.randint(1,8) % 2
			if remainder == 0:
				readable = "false"
		else:
			readable = visibility
		ids = [];
		# generate a block according to the list of req types
		for j in range(len(req_types)):
			rid = str(index + offset + j)

			if req_types[j] == "post":
				date = rid
				workloads.append({
					"RID": rid,
					"REQUEST TYPE": "post",
					"DATE": date + "-",
					"MESSAGE": "".join(random.choice(string.ascii_lowercase) for index in range(index % 10 + 1)),
					"READABLE": readable
				})
				ids.append(date);
			elif req_types[j] == "get":
				if len(ids) == 0:
					print("ERROR: read before insert in the trace")
					exit(-1)
				date = random.choice(ids);
				workloads.append({
					"RID": rid,
					"REQUEST TYPE": "get",
					"DATE": date + "-"
				})
			else:
				print("ERROR: unknown request type")
				exit(-1)

			i += 1
			if i >= t_req_no:
				return workloads

	return workloads


def stackTrace_generator(tid, offset, t_req_no, req_types):
	workloads = []
	# generate >= 1 blocks of req types
	i = 0
	while i < t_req_no:
		index = i + 1
		hash_id = None

		# generate the trace according to the list of req types
		ids = [];
		for j in range(len(req_types)):
			rid = str(index + offset + j)

			if req_types[j] == "post":
				hash_id = rid
				workloads.append({
					"RID": rid,
					"REQUEST TYPE": "post",
					"HASH": hash_id,
					"VALUE": "".join(random.choice(string.ascii_lowercase) for index in range(index % 10 + 1))
				})
				ids.append(hash_id);
			elif req_types[j] == "get":
				if len(ids) == 0:
					print("ERROR: read before insert in the trace")
					exit(-1)
				hash_id = random.choice(ids);
				workloads.append({
					"RID": rid,
					"REQUEST TYPE": "get",
					"HASH": hash_id
				})
			elif req_types[j] == "list":
				workloads.append({
					"RID": rid,
					"REQUEST TYPE": "list"
				})
			elif req_types[j] == "wait":
				workloads.append({
					"REQUEST TYPE": "wait"
				})
			else:
				print("ERROR: unknown request type")
				exit(-1)

			i += 1
			if i >= t_req_no:
				return workloads

	return workloads


def inventory_generator(tid, offset, t_req_no, req_types, visibility):
	workloads = []
	# generate >= 1 blocks of req types
	i = 0
	while i < t_req_no:
		index = i + 1
		id_type = None

		# if visibility is not defined, set it randomly
		if not visibility:
			visible = "true"
			remainder = random.randint(1,8) % 2
			if remainder == 0:
				visible = "false"
		else:
			visible = visibility

		# generate the trace according to the list of req types
		ids = [];
		for j in range(len(req_types)):
			rid = str(index + offset + j)

			if req_types[j] == "add":
				id_type = rid
				workloads.append({
					"RID": rid,
					"REQUEST TYPE": "add",
					"ID TYPE": id_type + "-",
					"QUANTITY": random.randint(1,10000),
					"VISIBLE": visible
				})
				ids.append(id_type);
			elif req_types[j] == "get":
				if len(ids) == 0:
					print("ERROR: read before insert in the trace")
					exit(-1)
				id_type = random.choice(ids);
				workloads.append({
					"RID": rid,
					"REQUEST TYPE": "get",
					"ID TYPE": id_type + "-"
				})
			elif req_types[j] == "update":
				if len(ids) == 0:
					print("ERROR: read before insert in the trace")
					exit(-1)

				id_type = random.choice(ids);
				workloads.append({
					"RID": rid,
					"REQUEST TYPE": "update",
					"ID TYPE": id_type + "-",
					"QUANTITY": random.randint(1,10000)
				})
			elif req_types[j] == "hide":
				if len(ids) == 0:
					print("ERROR: read before insert in the trace")
					exit(-1)

				id_type = random.choice(ids);
				workloads.append({
					"RID": rid,
					"REQUEST TYPE": "hide",
					"ID TYPE": id_type + "-"
				})
			elif req_types[j] == "unhide":
				if len(ids) == 0:
					print("ERROR: read before insert in the trace")
					exit(-1)

				id_type = random.choice(ids);
				workloads.append({
					"RID": rid,
					"REQUEST TYPE": "unhide",
					"ID TYPE": id_type + "-"
				})
			else:
				print("ERROR: unknown request type")
				exit(-1)

			i += 1
			if i >= t_req_no:
				return workloads

	return workloads

def two_arg_micro_generator(tid, offset, t_req_no, req_types):
	workloads = []
	#req_types should be of the form request_$total_$first
	# generate >= 1 blocks of req types
	[total, k] = req_types[0].split("_")[1:];
	for i in range(1, t_req_no + 1):
		rid = str(offset + i)
		workloads.append({
			"RID": rid,
			"TOTAL": int(total),
			"k": int(k),
		})
	return workloads

def one_arg_micro_generator(tid, offset, t_req_no, req_types):
	workloads = []
	#req_types should be of the form request_$total
	# generate >= 1 blocks of req types
	[total] = req_types[0].split("_")[1:];
	for i in range(1, t_req_no + 1):
		rid = str(offset + i)
		workloads.append({
			"RID": rid,
			"TOTAL": int(total),
		})
	return workloads
