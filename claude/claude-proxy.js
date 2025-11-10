// server.js
import Fastify from "fastify";
import LoggerManage from "../logger-manager.js" 

let  logger = LoggerManage.getLogger("claudecode");
const BASE_URL = process.env.BASE_URL;// || "https://api.anthropic.com";
logger.system.debug("-------------Clogger Start--------------------------");

// 配置文件相关功能
let toolsConfig = {
  blacklist: [],
  descriptions: {}
};

function loadToolsConfig() {
  try {
    const configPath = join(process.cwd(), '.tools.json');
    const configContent = readFileSync(configPath, 'utf8');
    const config = JSON.parse(configContent);

    if (config.tools) {
      toolsConfig.blacklist = config.tools.blacklist || [];
      toolsConfig.descriptions = config.tools.descriptions || {};
      logger.system.debug(`成功加载配置文件，黑名单: ${toolsConfig.blacklist.length} 个工具，描述重写: ${Object.keys(toolsConfig.descriptions).length} 个工具`);
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      logger.system.debug('未找到 .tools.json 配置文件，使用默认配置');
    } else {
      logger.system.error(`加载配置文件失败: ${error.message}`);
    }
  }
}

// 在启动时加载配置
loadToolsConfig();

function deepClone(obj) {
  const result = JSON.parse(JSON.stringify(obj));
  return result;
}

// 处理请求body中的tools，应用黑名单过滤和描述改写
function processRequestTools(body) {
  if (!body || !body.tools || !Array.isArray(body.tools)) {
    return body;
  }

  const originalCount = body.tools.length;

  // 过滤黑名单中的工具
  body.tools = body.tools.filter(tool => {
    const toolName = tool.name || tool.function?.name;
    if (!toolName) return true;

    const isBlacklisted = toolsConfig.blacklist.includes(toolName);
    if (isBlacklisted) {
      logger.system.debug(`过滤黑名单工具: ${toolName}`);
    }
    return !isBlacklisted;
  });

  // 改写工具描述
  body.tools = body.tools.map(tool => {
    const toolName = tool.name || tool.function?.name;
    if (toolName && toolsConfig.descriptions[toolName]) {
      logger.system.debug(`改写工具描述: ${toolName} -> ${toolsConfig.descriptions[toolName]}`);

      // 根据工具结构更新描述
      if (tool.description !== undefined) {
        tool.description = toolsConfig.descriptions[toolName];
      } else if (tool.function && tool.function.description !== undefined) {
        tool.function.description = toolsConfig.descriptions[toolName];
      }
    }
    return tool;
  });

  const filteredCount = body.tools.length;
  if (originalCount !== filteredCount) {
    logger.system.debug(`工具过滤完成: ${originalCount} -> ${filteredCount}`);
  }

  return body;
}
function formateLine(str){
    let r = str.replace(/\\n/g, '\n');
    return r;
}
function toSimpleLog(fullLog){
    //删除 tool 列表
    let  slog = deepClone(fullLog);
    let result = {
        request:slog.request.body.messages,
        response:slog.response.body.content
    };
    return result;
}

function logAPI(fullLog){
    //console.log('Writing to log files...');
    try {
        logger.full.debug(fullLog);
        logger.simple.debug(toSimpleLog(fullLog));

        // 立即同步到文件
        if (logger.full.flush) {
            logger.full.flush();
        }
        if (logger.simple.flush) {
            logger.simple.flush();
        }

       // console.log('Log files written successfully');
    } catch (error) {
        console.error('Error writing to log files:', error);
    }
}

function headersToObject(headers) {
  const obj = {};
  try {
    for (const [k, v] of headers.entries()) obj[k] = v;
  } catch {}
  return obj;
}

const fastify = Fastify(
    {
        requestTimeout: 0,          // never time out request (or set e.g. 10 * 60 * 1000)
        connectionTimeout: 0,       // no connection timeout
        keepAliveTimeout: 120000,   // 120s
    }
);

// 注册一个 POST 接口
fastify.all("/*", async (request, reply) => {
   //console.log("处理请求:", request.url);
   return await handel(request, reply, request.url);
});
function joinUrl(base, ...paths) {
  return [base.replace(/\/+$/, ''), ...paths.map(p => p.replace(/^\/+/, ''))]
    .join('/');
}

async function handel(request, reply, endpoint){
      const url = joinUrl(BASE_URL , endpoint);
      const endpoints = [
          '/v1/messages',
          '/anthropic/v1/messages'
      ];
  
      let urlPath = (new URL(url)).pathname;
  
      if(!(endpoints.some(t => urlPath.includes(t) && (request.method == "POST" || request.method == "post" )))){
         logger.system.debug("不是模型请求直接返回" +request.method +":" + url +" -> " + urlPath);
         return fetch(input,init);
      }
  
      //打印请求信息 request.body
      let processedBody = request.body;
  
      // 如果是模型请求，处理请求body中的tools
      if (request.body) {
        try {
          const bodyObj = JSON.parse(request.body);
          const processedBodyObj = processRequestTools(bodyObj);
          processedBody = JSON.stringify(processedBodyObj);
  
          if (processedBody !== request.body) {
              logger.system.debug('请求body中的tools已被处理');
          }
        } catch (error) {
          logger.system.error(`处理请求body失败: ${error.message}`);
          // 如果处理失败，使用原始body
          processedBody = request.body;
        }
      }
    //如果对 tools 修改了这里的长度肯定要变化的
    let requestHeaders = {...request.headers}
        delete requestHeaders["content-length"]; //可能还有大小写问题 
      //console.log(requestHeaders);
    
    let response;
    try{
        response = await fetch(url, {
          method: request.method,
          headers: requestHeaders,
          body: processedBody,
        });
      
    }catch(e){
      console.log(e);
    }
  
      // 检查响应状态，处理错误情况
      if (!response.ok) {
        // 读取原始错误响应
        const errorText = await response.text();
        logger.system.error(`API error response: ${response.status} ${response.statusText}`, {
          url: url,
          status: response.status,
          errorResponse: errorText
        });
  
        // 尝试解析错误响应并转换为通用错误格式
        let errorResponse;
        try {
          const originalError = JSON.parse(errorText);
          // 构建通用错误响应格式
          errorResponse = {
            type: "error",
            error: {
              type: "api_error",
              message: originalError.error?.message || originalError.message || `API error: ${response.statusText}`,
              code: originalError.error?.code || originalError.code || `API_${response.status}_ERROR`
            }
          };
  
          // 如果有详细错误信息，保留原始结构
          if (originalError.error?.details) {
              errorResponse.error.details = originalError.error.details;
          }
  
        } catch (parseError) {
          // 如果无法解析错误JSON，使用通用错误格式
          logger.system.error(`Failed to parse error response: ${parseError.message}`);
          errorResponse = {
            type: "error",
            error: {
              type: "api_error",
              message: `API error: ${response.statusText}`,
              code: `API_${response.status}_ERROR`
            }
          };
        }
  
        // 返回标准化的错误响应
        return new Response(JSON.stringify(errorResponse), {
          status: response.status,
          statusText: response.statusText,
          headers: {
            "Content-Type": "application/json"
          }
        });
      }
  
      //response = proxyResponse(response);
      let responseToClient = response.clone()
      // stream 不能通过 content type 判断，
      let isStream = true;
      if(Object.hasOwn(request.body, "stream") &&  !request.body.stream){
          isStream = false;
          logger.full.debug("模型不是流请求");
      }
    
  
      //完整的请求日志，保护请求和响应
      let fullLog = {request:{
          url:url,
          method: request.method,
          headers: headersToObject(request.headers),
          body: JSON.parse(processedBody)
        },response:{
              status: response.status,
              statusText: response.statusText,
              headers: headersToObject(response.headers)
        }};
  
        try{
            //日志解析要异步执行保证效率
            (async ()=>{
              if(isStream){
                let alllog = await response.text();
                //logger.full.debug("alllog "+alllog)
                fullLog.response.body = mergeAnthropic(alllog);   
              }else{
                 fullLog.response.body = await response.json();
              }
        
             // logger.full.debug("adassdadadadad>>>>>>" + JSON.stringify(fullLog));
             
              logAPI(fullLog);
  
            })().catch(err => logger.system.error('日志解析错误:' + "\nStack trace: " + err.stack));
          
  
  
          return new Response(responseToClient.body, {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers
          });
        }catch(e){
          logger.system.error(e);
        }
}

// 启动服务
const startServer = async () => {
  try {
    await fastify.listen({ port: 3000, host: "0.0.0.0" });
    logger.system.debug("✅ Server started");
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
startServer();