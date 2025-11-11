// server.js
import Fastify from "fastify";
import {mergeAnthropic}  from '../api-anthropic.js';
import LoggerManage from "../logger-manager.js";
import { join } from "path";
import { readFileSync } from "fs";
import anthropicTransformer from  "../anthropic-transformer.js"
import {parseOpenAIChatCompletion} from "../api-openai.js";
import portManager from '../port-manager.js';

let logger = LoggerManage.getLogger("claudecode");
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
         // 将Fastify请求转换为标准的fetch请求
         const fetchOptions = {
           method: request.method,
           headers: headersToObject(request.headers),
         };

         // 如果有请求体，添加到fetch选项中
         if (request.body) {
           fetchOptions.body = typeof request.body === 'string' ? request.body : JSON.stringify(request.body);
           // 确保Content-Type头存在
           if (!fetchOptions.headers['content-type'] && !fetchOptions.headers['Content-Type']) {
             fetchOptions.headers['content-type'] = 'application/json';
           }
         }

         return fetch(url, fetchOptions);
      }

      //console.log("请求地址: " + url);
          //转换前的请求
          let initBody    = request.body;
          //请求的 JSON 
          let requestBody = await anthropicTransformer.transformRequestOut(initBody);
          //转换后的请求
          let openaiRequestBodyString = JSON.stringify(requestBody);
              
          //console.log(JSON.parse(openaiRequestBody));
         
          //打印请求信息 init.body
          const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.ANTHROPIC_AUTH_TOKEN}`
            },
            body: openaiRequestBodyString,
          });
      
          let responseToClient = response.clone();
      
          // 判断OpenRouter响应是否为异常
          if (!response.ok) {
            // 读取OpenRouter错误响应
            const openrouterErrorText = await response.text();
            logger.system.error(`OpenRouter API error response: ${response.status} ${response.statusText}`, {
              url: url,
              status: response.status,
              errorResponse: openrouterErrorText
            });
      
            // 将OpenRouter错误响应转换为Claude Code错误响应格式
            let claudeErrorResponse;
            try {
              const openrouterError = JSON.parse(openrouterErrorText);
              claudeErrorResponse = {
                type: "error",
                error: {
                  type: "api_error",
                  message: openrouterError.error?.message || `OpenRouter API error: ${response.statusText}`,
                  code: `OPENROUTER_${response.status}_ERROR`
                }
              };
            } catch (parseError) {
              // 如果无法解析OpenRouter的错误JSON，使用通用错误格式
              claudeErrorResponse = {
                type: "error",
                error: {
                  type: "api_error",
                  message: `OpenRouter API error: ${response.statusText}`,
                  code: `OPENROUTER_${response.status}_ERROR`
                }
              };
            }
      
            // 返回转换后的错误响应
            return new Response(JSON.stringify(claudeErrorResponse), {
              status: response.status,
              statusText: response.statusText,
              headers: {
                "Content-Type": "application/json"
              }
            });
          }
      
          //完整的请求日志，保护请求和响应
          let fullLog = {request:{
              url:url,
              method: init.method,
              headers: headersToObject(init.headers),
              body: initBody
            },response:{
                  status: response.status,
                  statusText: response.statusText,
                  headers: headersToObject(response.headers)
            },openai:{
              request: {
                 body: requestBody
              },
              response: {}
            }};
      
          let         res = await anthropicTransformer.transformResponseIn(responseToClient);
          let toClientRes = await res.clone();
      
          (async () => {
             
            fullLog.openai.response.body  =  await parseOpenAIChatCompletion(await response.text());
            fullLog.response.body         =  mergeAnthropic(await res.text());
      
            //其他类型是错误的
            logAPI(fullLog);
      
          })().catch(err => console.error('日志解析错误:', err));
      
          return toClientRes;
  
}

// 启动服务
const startServer = async () => {
  try {
    // 从环境变量获取端口，如果没有则动态分配
    let port = process.env.PROXY_PORT ? parseInt(process.env.PROXY_PORT) : null;

    if (!port) {
      port = await portManager.getAvailablePort();
      if (!port) {
        logger.system.error('无法获取可用端口');
        process.exit(1);
      }
    }

    await fastify.listen({ port: port, host: "0.0.0.0" });
    logger.system.debug(`✅ Server started on port ${port}`);

    // 输出端口信息到标准输出，供父进程读取
    console.log(`PROXY_PORT:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
startServer();