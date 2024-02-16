threads = {} -- A table of all the threads we use
thread_counter = 1
ignored_first = false -- HACK HACK HACK: we need to ignore the very first request

requests = {}
request_data ={}
init_time = os.clock()

--Write the trace in a file. It is unordered but it has timestamps
function write_trace(advice_loc, threads) 
	trace_loc=advice_loc .. os.getenv("TRACE_TEMP_LOC")
        file = io.open(trace_loc, "w")
        io.output(file)
        for idx, thread in ipairs(threads) do
                if idx ~= 1 then
                        io.write("\n")
                end
                io.write(thread:get("trace"))
        end
        io.close(file)
end

function file_exists(file)
  local f = io.open(file, "rb")
  if f then f:close() end
  return f ~= nil
end

-- convert a csv file to a table, returns an empty
-- list/table if the file does not exist
function csvToTable(file)
        if not file_exists(file) then return {} end
        local firstLine = true
        local pattern = "%s*(.*),%s*(.*),%s*(.*)"
        lines = {}
        for line in io.lines(file) do
                line = line:gsub("[\n\r]", "")
                if firstLine then
                        firstLine = false
                else
                        local v1,v2,v3 = line:match(pattern)
                        if v1 == nil then
                                return {{["err"]="Unknown request type"}}
                        end
                    lines[#lines + 1] = {rid = v1, reqtype = v2, dt = v3} 
                end
        end
        return lines
end

-- fill requests and request_data
function prepareRequests(thread_id)
        --read from workload file that corresponds to this thread
        local dir = os.getenv("CONF_FILE")
        local file = dir .. "/t" .. thread_id .. ".csv"
        local lines = csvToTable(file)
        requests[thread_id] = {}
        request_data[thread_id] = {}
        ---- Prepare workload
        for i, data in ipairs(lines) do
                local rid = data["rid"]
                local reqtype=data["reqtype"]
                local dt=data["dt"]
                --headers--
                local headers = {}
                headers["Content-type"] = "application/json"
                headers["user-agent"] = "Karousos"
                headers["x-request-id"] = tostring(rid)
                --data--
                local method = ""
                local databody=""
                local pagePath = ""
                print (reqtype)
                if reqtype == "postComment" then
                    method = "POST"
                    databody = '{"dt":"' .. dt .. '"}'
                end 
                if reqtype == "getPage" then
                        method = "POST"
                        databody = ""
                        databody='{"pagePath":"' .. dt .. '"}'
                end
                 if reqtype == "addPage" then
                        method= "POST"
                        databody='{"pagePath":"' .. dt .. '"}'
                 end
                ----------------------------databody = '{"total_accesses":' .. total_accesses .. '}'
                --- Set up the i-th request of the thread with id thread_id ---
                if reqtype=="postComment" then
                print("post comment request")
                        requests[thread_id][i] = wrk.format(method, "http://localhost:8000/comments/post", headers,databody)
                        request_data[thread_id][i] = {}
                        request_data[thread_id][i]["method"] = method
                        request_data[thread_id][i]["x-request-id"] = tostring(rid)
                        request_data[thread_id][i]["data"] = '{"url": "http://localhost:8000/comments/post","body":' .. databody ..'}'
                        reqs_to_send = reqs_to_send + 1
                elseif reqtype=="addPage" then
                        print("add Page request")
                        requests[thread_id][i] = wrk.format(method, "http://localhost:8000/pages/create", headers,databody)
                        request_data[thread_id][i] = {}
                        request_data[thread_id][i]["method"] = method
                        request_data[thread_id][i]["x-request-id"] = tostring(rid)
                        request_data[thread_id][i]["data"] = '{"url": "http://localhost:8000/pages/create","body":' .. databody ..'}'
                        reqs_to_send = reqs_to_send + 1
                elseif reqtype=="getPage" then
                        print("post comment request")
                        requests[thread_id][i] = wrk.format(method, "http://localhost:8000/en/renderPage", headers,databody)
                        request_data[thread_id][i] = {}
                        request_data[thread_id][i]["method"] = method
                        request_data[thread_id][i]["x-request-id"] = tostring(rid)
                        request_data[thread_id][i]["data"] = '{"url": "http://localhost:8000/en/renderPage","body":' .. databody ..'}'
                        reqs_to_send = reqs_to_send + 1
                end
        end
end

--- Sets up the threads we use -----
setup = function(thread)
        thread:set("id", thread_counter)
        table.insert(threads, thread)
        thread:set("request_idx", 1)
        thread:set("init_time", init_time)
        thread_counter = thread_counter + 1
        thread:set("trace", "")
        thread:set("sent_reqs", {})
end

--- init requests and request_data when the thread starts running ---
init = function(args)
        reqs_to_send = 0 -- the number of requests we send
        prepareRequests(wrk.thread:get("id"))
end

request = function()
        -- if we have already sent all requests, stop the thread
        if request_idx > reqs_to_send then
                wrk.thread:stop()
        else
                tid = wrk.thread:get("id")
                local req = requests[tid][request_idx]
                -- HACK HACK HACK
                -- Only save the request if this is not the first request that we are sending
                -- The first request that wrk sends seems to not reach the server
                if id > 1 or ignored_first then
                        trace = save_request(trace, os.clock(), init_time, request_data[tid][request_idx]["x-request-id"], request_data[tid][request_idx]["method"], request_data[tid][request_idx]["data"])
                end
                if id == 1 and ignored_first == false then
                        ignored_first = true
                end
                return req
        end
end

response = function(status, headers, body)
        local tid = wrk.thread:get("id")
        trace = save_response(trace, os.clock(), init_time, request_data[tid][request_idx]["x-request-id"], body)
        request_idx = request_idx + 1
        -- terminate the thread if we have already sent all requests
        if request_idx > reqs_to_send then
                wrk.thread:stop()
        end
end

-- Called when the workload has been sent
done = function(results, latency)
        if os.getenv("IS_PROVER") == "false" then
                for idx, thread in ipairs(threads) do
                        print(thread:get("trace"))
                end
                return
        end
	write_trace(os.getenv("ADVICE_DIR"), threads)
	if os.getenv("COLLECT_OROCHI_JS_ADVICE") == "true" then
		write_trace(os.getenv("ADVICE_DIR_OROCHI_JS"), threads)
	end
end

save_request = function(trace, time_now, init_time, rid, method, data)
        entry = time_now - init_time .. ",REQUEST," .. rid .. "," .. method .. "," .. data
        if trace == "" then
                return entry
        else
                return trace .. "\n" .. entry
        end
end

save_response = function(trace, time_now, init_time, rid, data)
        entry = time_now - init_time .. ",RESPONSE,".. rid .. "," .. enc(data)
        if trace == "" then
                return entry
        else
                return trace .. "\n" .. entry
        end
end


local b='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/' -- You will need this for encoding/decoding
-- encoding
function enc(data)
    return ((data:gsub('.', function(x) 
        local r,b='',x:byte()
        for i=8,1,-1 do r=r..(b%2^i-b%2^(i-1)>0 and '1' or '0') end
        return r;
    end)..'0000'):gsub('%d%d%d?%d?%d?%d?', function(x)
        if (#x < 6) then return '' end
        local c=0
        for i=1,6 do c=c+(x:sub(i,i)=='1' and 2^(6-i) or 0) end
        return b:sub(c+1,c+1)
    end)..({ '', '==', '=' })[#data%3+1])
end

-- decoding
function dec(data)
    data = string.gsub(data, '[^'..b..'=]', '')
    return (data:gsub('.', function(x)
        if (x == '=') then return '' end
        local r,f='',(b:find(x)-1)
        for i=6,1,-1 do r=r..(f%2^i-f%2^(i-1)>0 and '1' or '0') end
        return r;
    end):gsub('%d%d%d?%d?%d?%d?%d?%d?', function(x)
        if (#x ~= 8) then return '' end
        local c=0
        for i=1,8 do c=c+(x:sub(i,i)=='1' and 2^(8-i) or 0) end
            return string.char(c)
    end))
end
