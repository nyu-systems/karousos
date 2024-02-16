from my_object import *
import json

#MyObject wrapper: id, dictionary
#input: binlog.txt (mysqlbinlog's output)
#output: binlog.json
'''
Target row-based binlog event: 
>>>transactional log events (DML & transactional table)
wrapped with BEGIN-COMMIT
CHECK1	-ROLLBACK, ROLLBACK TO, XA start/end are detected in [modified mysqlbinlog]
			exceptions are raised if we encounter them.
		-What to do with the above three events in the [parser]:
			-ROLLBACKs, ROLLBACK TO: raise exception.
			-XA start/end: ignore them here
CHECK2	-no nested trx; no incomplete trx (BEGIN-COMMIT wrapping)
		-detected in [modified mysqlbinlog] & in the [parser]
'''
'''
objects are stored as rows in database
Database table layout:
ID(coln 1) .... rid(coln n-2), txid(coln n-1), txnum(coln n)
We only care about the last three columns which are the same for any table
Using MyObject wrapper, their column NAMEs instead of column INDEX appear in the output file
'''

def get_binlog(filename):
	binlog = []
	f = open(filename, "r")
	for line in f:
		binlog.append(line.rstrip())
	f.close()
	return binlog

def get_coln(line):
	#format -v: ###   @coln=value
	#format -vv: ###   @coln=value /*format description*/
	start = line.index("@")
	end = line.index("=")
	return int(line[start + 1 : end])

def get_value(line):
	#format -v: ###   @coln=value
	#format -vv: ###   @coln=value /*format description*/
	start = line.index("=")
	try:
		end = line.index("/*")
		ret = line[start + 1:end]
		ret = ret.rstrip().strip("'")
	except:
		ret = line[start + 1:]
		ret = ret.strip("'")
	# if ret.isdigit():
	# 	ret = int(ret)
	return ret

def parse(binlog):
	#counter for ROLLBACK to ignore the format description ROLLBACK
	count = 0
	#switch transaction state
	in_trx = False
	#switch rows_log_event state!!! ignore DELETE for now
        #an entry: no difference between UPDATE and INSERT, both write (SET) a row
	entry = False
	#SET: start indicator of contents of a rows_log_event
	set_clause = False
	#output list of MyObject dictionaries
	trxs = []
	#keep track of object modification order in one trx, always record the latest
	one_trx_order = []
	#dictionary of modified object in one trx: MyObject
	one_trx = {}
	#keep track of current object id
	curr_id = None

	#start parse binlog
	for line in binlog:
	#switch trx state
		if line == "BEGIN":
			if not in_trx:
				in_trx = True
			else:
				print(line)
				raise Exception("Starting trx inside a trx")
		elif line == "COMMIT/*!*/;":
			if in_trx:
				#commit the latest object modifications of a trx at once to trxs list
				for key in one_trx_order:
					trxs.append(one_trx[key].get())
				in_trx = False
				#re-init
				one_trx_order = []
				one_trx = {}
			else: 
				print(line)
				raise Exception("No trx is started")
		elif "ROLLBACK" in line:
			in_trx = False
			count += 1
			if count > 1:
				one_trx_order = []
				one_trx = {}
				raise Exception("Shouldn't log ROLLBACKs")
	#parse one trx
		if in_trx:
			#start record rows_log_event
			if "UPDATE" in line or "INSERT" in line:
                                set_clause = False
                                if not entry:
                                    entry = True
				#else:
					#raise Exception("Previous rows log event not ended")
			#SET only appears in UPDATE & INSERT rows_log_events
			#start record modifications to each column in the row
			if "SET" in line and entry == True:
				set_clause = True
			#end of an event == start of a new event
			#(re-)init curr_id
			if "# at" in line and entry == True:
				entry = False
				set_clause = False
				curr_id = None
			#parse column modifications
			#format -v: ###   @coln=value
			#format -vv: ###   @coln=value /*format description*/
			if line[:6] == "###   ":
				if set_clause:
					coln = get_coln(line)
					if coln == 1:
						curr_id = get_value(line)
						if curr_id not in one_trx_order:
							#add object if not modified before
							one_trx_order.append(curr_id)
							new_object = MyObject(curr_id)
							new_object.set(curr_id, coln)
							one_trx[curr_id] = new_object
						else:
							#curr object becomes the latest modified
							one_trx_order.remove(curr_id)
							one_trx_order.append(curr_id)
					else:
						value = get_value(line)
						one_trx[curr_id].set(value, coln)
	return trxs


if __name__ == '__main__':
        filepaths = input().split()
        binlog_path = filepaths[0]
        json_path = filepaths[1]

        binlog = get_binlog(binlog_path)
        trxs = parse(binlog)
	#to json
        with open(json_path, 'w') as outfile:
            json.dump(trxs, outfile, indent=4)