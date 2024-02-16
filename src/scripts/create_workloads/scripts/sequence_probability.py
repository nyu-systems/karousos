import sys,os
import string
import random
from utils import *
import copy
import math 

# all apps random post/get request generator
def is_post(post_prob):
	return random.random() * 100 < post_prob

#Returns 0 for post, 1 for list and 2 for get
def get_req_type(post_prob, list_prob, insert_prob):
	no = random.random() * 100
	if no < post_prob * insert_prob / 100:
		return 0
	elif no < post_prob: 
		return 1
	elif no < post_prob + list_prob:
		return 2
	else:
		return 3

# generate requests by probability

def message_generator(tid, offset, t_req_no, post_prob, object_ids_init, visibility):
	workloads = []
	posts = int(t_req_no * post_prob // 100);
	gets = int(t_req_no * (100 - post_prob) // 100);
	assert(posts + gets == t_req_no)
	object_ids = copy.deepcopy(object_ids_init);
	for i in range(t_req_no):
		index = i + 1

		# if visibility is not defined, set it randomly
		if not visibility:
			readable = "true"
			remainder = random.randint(1,8) % 2
			if remainder == 0:
				readable = "false"
		else:
			readable = visibility

		rid = str(index + offset)

		if not object_ids:
			# the first request is post
			workloads.append({
				"RID": rid,
				"REQUEST TYPE": "post",
				"DATE": rid + "-",
				"MESSAGE": "".join(random.choice(string.ascii_lowercase) for index in range(index % 10 + 1)),
				"READABLE": readable
			})
			object_ids.append(rid);
			posts -= 1;
		else:
			# generate requests by probability
			if is_post(post_prob):
				assert(rid not in object_ids)

				workloads.append({
					"RID": rid,
					"REQUEST TYPE": "post",
					"DATE": rid + "-",
					"MESSAGE": "".join(random.choice(string.ascii_lowercase) for index in range(index % 10 + 1)),
					"READABLE": readable
				})
				object_ids.append(rid)
				posts -= 1;
			else:
				if not object_ids:
					print("ERROR: read before write")
					exit(-1)

				workloads.append({
					"RID": rid,
					"REQUEST TYPE": "get",
					"DATE": random.choice(object_ids) + "-"
				})
				gets -= 1;
	if posts != 0 or gets != 0:
		return  message_generator(tid, offset, t_req_no, post_prob, object_ids_init, visibility);

	return workloads


def stackTrace_generator(tid, offset, t_req_no, post_prob, list_prob, insert_prob, init_object_ids):
	workloads = []
	inserts = math.ceil(t_req_no * post_prob * insert_prob / 10000);
	updates = int(t_req_no * post_prob // 100) - inserts; 
        gets = int(t_req_no * (100 - post_prob - list_prob) // 100);
	lists = int(t_req_no * list_prob // 100);
	object_ids = copy.deepcopy(init_object_ids);
        assert(inserts + updates + gets + lists == t_req_no);
	print(inserts, updates, gets, lists);
        for i in range(t_req_no):
		index = i + 1

		rid = str(index + offset)

		if not object_ids:
			# the first request is post
			workloads.append({
				"RID": rid,
				"REQUEST TYPE": "post",
				"HASH": rid,
				"VALUE": "".join(random.choice(string.ascii_lowercase) for index in range(index % 10 + 1))
			})
			object_ids.append(rid)
			inserts -= 1;
		else:
			# generate requests by probability
			t = get_req_type(post_prob, list_prob, insert_prob)
			if t == 0:
				workloads.append({
					"RID": rid,
					"REQUEST TYPE": "post",
					"HASH": rid,
					"VALUE": "".join(random.choice(string.ascii_lowercase) for index in range(index % 10 + 1))
				})
				object_ids.append(rid);
				inserts -= 1;
			elif t==1:
				workloads.append({
					"RID": rid,
					"REQUEST TYPE": "post",
					"HASH": random.choice(object_ids),
					"VALUE": "".join(random.choice(string.ascii_lowercase) for index in range(index % 10 + 1))
				})
				updates -= 1;
			elif t == 2:
				workloads.append({
					"RID": rid,
					"REQUEST TYPE": "list",
					"HASH": "",
					"VALUE": ""
				})
				lists -= 1;
			else:
				if not object_ids:
					print("ERROR: read before write")
					exit(-1)

				workloads.append({
					"RID": rid,
					"REQUEST TYPE": "get",
					"HASH": random.choice(object_ids)
				})
				lists -= 1;
        if updates != 0 or inserts != 0 or lists != 0 or gets != 0:
		return stackTrace_generator(tid, offset, t_req_no, post_prob, list_prob, insert_prob, init_object_ids);
	return workloads

# inventory post and get only
def inventory_generator(tid, offset, t_req_no, post_prob, upd_prob, init_object_ids, visibility):
	workloads = []
	types = ["add", "get", "update", "hide", "unhide"]
	probs = [
		post_prob * (100 - upd_prob) / 100,
		100 - post_prob,
		post_prob * upd_prob / 300,
		post_prob * upd_prob / 300,
		post_prob * upd_prob / 300,
	];
	posts = int(t_req_no * post_prob * (100 -upd_prob) // 10000); 
	updates = int(t_req_no * post_prob * upd_prob // 10000); 
	gets = int(t_req_no * (100 - post_prob) // 100); 
	if posts + gets + updates < t_req_no:
		posts += 1;
	assert(posts + gets + updates == t_req_no);
	object_ids = copy.deepcopy(init_object_ids);
	def random_inventory_req_type():
		rand = random.random() * 100

		s = 0
		for i in range(len(probs)):
			s += probs[i]
			if rand < s:
				return types[i]


	for i in range(t_req_no):
		index = i + 1

		# if visibility is not defined, set it randomly
		if not visibility:
			visible = "true"
			remainder = random.randint(1,8) % 2
			if remainder == 0:
				visible = "false"
		else:
			visible = visibility

		rid = str(index + offset)

		if not object_ids:
		# the first request is add
			workloads.append({
				"RID": rid,
				"REQUEST TYPE": "add",
				"ID TYPE": rid + "-",
				"QUANTITY": random.randint(1,10000),
				"VISIBLE": visible
			})
			object_ids.append(rid);
			posts -= 1;
		else:
			req_type = random_inventory_req_type()
			if req_type == "add":
				assert(rid not in object_ids)

				workloads.append({
					"RID": rid,
					"REQUEST TYPE": "add",
					"ID TYPE": rid + "-",
					"QUANTITY": random.randint(1,10000),
					"VISIBLE": visible
				})
				object_ids.append(rid);
				posts -= 1;
			elif req_type == "get":
				if not object_ids:
					print("ERROR: read before write")
					exit(-1)

				workloads.append({
					"RID": rid,
					"REQUEST TYPE": "get",
					"ID TYPE": random.choice(object_ids) + "-"
				})
				gets -= 1;
			elif req_type == "update":
				if not object_ids:
					print("ERROR: read before write")
					exit(-1)

				workloads.append({
					"RID": rid,
					"REQUEST TYPE": "update",
					"ID TYPE": random.choice(object_ids) + "-",
					"QUANTITY": random.randint(1,10000)
				})
				updates -= 1;
			elif req_type == "hide":
				if not object_ids:
					print("ERROR: read before write")
					exit(-1)

				workloads.append({
					"RID": rid,
					"REQUEST TYPE": "hide",
					"ID TYPE": random.choice(object_ids) + "-"
				})
				updates -= 1;
			elif req_type == "unhide":
				if not object_ids:
					print("ERROR: read before write")
					exit(-1)

				workloads.append({
					"RID": rid,
					"REQUEST TYPE": "unhide",
					"ID TYPE": random.choice(object_ids) + "-"
				})
				updates -= 1;
			else:
				print("ERROR: unknown request type")
				exit(-1)
	if posts != 0 or gets != 0 or updates != 0:
		#We have not created the correct number of request types. Retry
		return inventory_generator(tid, offset, t_req_no, post_prob, upd_prob, init_object_ids, visibility);
	return workloads
