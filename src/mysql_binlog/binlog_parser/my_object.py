class MyObject:
	def __init__(self, ID):
		self._ID = ID
		self.attr = {}

	def set(self, value, coln):
		self.attr[coln] = value

	def get(self):
                l = len(self.attr.keys())
                #??? incomplete sanity check for (ID, ..., rid, txid, txnum)
                #only checks length, not actual content
                #should be more secure if check table & column mapping in mysql code, not sure where to start yet
                if l < 4:
	                raise Exception("Need at least 4 columns")
                ret = {}
                # for key in self.attr.keys():
                    # if key == l-2:
                ret["rid"] = self.attr[l-2]
		    # elif key == l-1:
                ret["txid"] = self.attr[l-1]
		    # elif key == l:
                ret["txnum"] = self.attr[l]
                return ret
                #return self.attr


