import net from 'net';

/**
 * 端口管理器
 * 用于动态分配可用端口
 */
class PortManager {
    constructor() {
        this.allocatedPorts = new Set();
        this.startPort = 3000;
        this.maxPort = 3999;
    }

    /**
     * 检查端口是否可用
     * @param {number} port - 要检查的端口
     * @returns {Promise<boolean>} - 端口是否可用
     */
    async isPortAvailable(port) {
        return new Promise((resolve) => {
            const server = net.createServer();

            server.once('error', (err) => {
                if (err.code === 'EADDRINUSE') {
                    resolve(false);
                } else {
                    resolve(false);
                }
            });

            server.once('listening', () => {
                server.close();
                resolve(true);
            });

            server.listen(port);
        });
    }

    /**
     * 获取一个可用端口
     * @returns {Promise<number|null>} - 可用端口或null
     */
    async getAvailablePort() {
        for (let port = this.startPort; port <= this.maxPort; port++) {
            if (this.allocatedPorts.has(port)) {
                continue;
            }

            const isAvailable = await this.isPortAvailable(port);
            if (isAvailable) {
                this.allocatedPorts.add(port);
                return port;
            }
        }

        return null;
    }

    /**
     * 释放端口
     * @param {number} port - 要释放的端口
     */
    releasePort(port) {
        this.allocatedPorts.delete(port);
    }

    /**
     * 获取当前已分配的端口
     * @returns {Set<number>} - 已分配的端口集合
     */
    getAllocatedPorts() {
        return new Set(this.allocatedPorts);
    }
}

// 创建全局单例实例
const portManager = new PortManager();

export default portManager;