import sys
import os
import csv

def readData(folder):
	files = os.listdir(folder)
	assert(len(files) == 1);
	assert("t1.csv" in files);
	fname = folder + "/t1.csv";
	with open(fname, 'r') as input_file:
		reader = csv.reader(input_file);
		rows = list(reader);
	return rows;

def splitRowDataInFiles(rowData, fileNo):
	assert((len(rowData) - 1) % fileNo == 0);
	reqs_per_file = (len(rowData) - 1) / fileNo;
	rowsPerFile = [];
	for i in range(fileNo):
		rowsPerFile.append([rowData[0]]);
	for i in range(1, len(rowData)):
		idx_of_file = (i-1) % fileNo;
		this_rid = idx_of_file * reqs_per_file + len(rowsPerFile[idx_of_file]);
		entry_to_write = rowData[i];
		entry_to_write[0] = str(int(this_rid));
		rowsPerFile[idx_of_file].append(entry_to_write);
	return rowsPerFile;

def writeTrace(folder, rowsPerFile):
	isExist = os.path.exists(folder)
	if not isExist:
		os.mkdir(folder);
	for i in range(len(rowsPerFile)):
		fname = folder + "/t" + str(i+1) + ".csv";
		with open(fname, 'w') as o:
			writer = csv.writer(o);
			for row in rowsPerFile[i]:
				writer.writerow(row);

if __name__ == "__main__":

	if (len(sys.argv)) < 3:
	 	print("ERROR: Need to supply at least 3 argument [input folder to be split] [output foler] [number of threads]!")
	 	sys.exit()

	rowData = readData(sys.argv[1]);
	rowsPerFile = splitRowDataInFiles(rowData, int(sys.argv[3]));
	writeTrace(sys.argv[2], rowsPerFile);
