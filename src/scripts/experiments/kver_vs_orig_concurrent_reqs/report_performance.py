import sys
import os
import csv
import statistics
import numpy as numpy

def get_total_time(fname, process):
	res = 0.0;
	with open(fname, 'r') as csv_file:
		lines = csv_file.read().split("\n");
		for line in lines:
			if line.endswith("\r"):
				line = line[:-1]
			if line == "":
				continue
			entries = line.split(",")
			if len(entries) != 2:
				print("ERROR: Wrong number of entries in " + csv_file + " !")
				sys.exit(-1)
			res += float(entries[1]);
	#add postprocess and preprocess times
	ptime = 0.0;
	if os.path.isfile(process):
		with open(process, 'r') as p:
			lines = p.read().split("\n");
			for line in lines:
				if line.endswith("\r"):
					line = line[:-1];
				if line == "":
					continue
				entries = line.split(",");
				res += float(entries[1]);
				ptime += float(entries[1]);
	return [ res, ptime ];

def get_values(t, folder):
	files = os.listdir(folder);
	total_times = [];
	process_times = [];
	print(files);
	if not("1" in files):
		fname = folder + "/active_time.csv";
		process = folder + "/process_advice.csv";
		[total, process ] = get_total_time(fname, process);
		total_times.append(total);
		process_times.append(process)
	else:
		for f in files:
			fname = folder + "/" + f + "/active_time.csv";
			process = folder +"/" + f + "/process_advice.csv";
			[total, process ] = get_total_time(fname, process);
			
			total_times.append(total);
			process_times.append(process)
	a = numpy.array(total_times);
	b = numpy.array(process_times)
	return [t ,  min(total_times), max(total_times), statistics.mean(total_times), statistics.median(total_times), numpy.percentile(a, 1), numpy.percentile(a, 5), numpy.percentile(a,95), numpy.percentile(a, 99), statistics.median(process_times), numpy.percentile(b, 5), numpy.percentile(b, 95)];


def report_performance(folder, out_f): 
	folder_orig = folder + "/original/";
	folder_v = folder + "/karousos-verifier/";
	orochi_js = folder + "/orochijs-verifier/";
	fields = ["Type", "Min", "Max", "Mean", "Median", "1 Percentile", "5 Percentile", "95 Percentile", "99 Percentile", "Process", "Process 5", "Process 95"];
	with open(out_f, 'w') as o: 
		writer = csv.writer(o);
		writer.writerow(fields);
		row = get_values("Original", folder_orig); 
		print(row);
		writer.writerow(row)
		row = get_values("Verifier", folder_v); 
		print(row);
		writer.writerow(row)
		row = get_values("Orochi-JS", orochi_js); 
		print(row);
		writer.writerow(row)

def report_advice_size(folder, out_f):
	fname = folder + "/karousos-verifier/0/advice_size.csv";
	with open(fname, 'r') as csv_file:
		lines = csv_file.read().split("\n");
		total = lines[0].split(",")[1];
	fname = folder + "/orochijs-verifier/0/advice_size.csv";
	with open(fname, 'r') as csv_file:
		lines = csv_file.read().split("\n");
		total_orochi_js = lines[0].split(",")[1];
	fields = ["Type", "Size"];
	with open(out_f, 'w') as o:
		writer = csv.writer(o);
		writer.writerow(fields)
		writer.writerow(["Karousos", total]);
		writer.writerow(["Orochi-JS", total_orochi_js]);

if __name__ == "__main__":	
	if (len(sys.argv)) < 3:
		print("ERROR: Need to supply at least 3 arguments!")
		print("Usage: " + sys.argv[0] + " [folder of experiments] [output file for time] [output file for advice size]")
		sys.exit()
	report_performance(sys.argv[1], sys.argv[2])
	report_advice_size(sys.argv[1], sys.argv[3]);
