import * as vscode from 'vscode';

export class Logger {
    private static outputChannel: vscode.OutputChannel | undefined;

    private static getOutputChannel(): vscode.OutputChannel {
        if (!this.outputChannel) {
            this.outputChannel = vscode.window.createOutputChannel('CodeGuardian AI');
        }
        return this.outputChannel;
    }

    static info(message: string, ...args: any[]): void {
        const timestamp = new Date().toISOString();
        const formattedMessage = `[${timestamp}] INFO: ${message}`;
        
        console.log(formattedMessage, ...args);
        this.getOutputChannel().appendLine(formattedMessage + (args.length > 0 ? ' ' + JSON.stringify(args) : ''));
    }

    static error(message: string, error?: any): void {
        const timestamp = new Date().toISOString();
        const formattedMessage = `[${timestamp}] ERROR: ${message}`;
        
        console.error(formattedMessage, error);
        this.getOutputChannel().appendLine(formattedMessage + (error ? ' ' + (error.stack || error.toString()) : ''));
        this.getOutputChannel().show(true);
    }

    static warn(message: string, ...args: any[]): void {
        const timestamp = new Date().toISOString();
        const formattedMessage = `[${timestamp}] WARN: ${message}`;
        
        console.warn(formattedMessage, ...args);
        this.getOutputChannel().appendLine(formattedMessage + (args.length > 0 ? ' ' + JSON.stringify(args) : ''));
    }

    static debug(message: string, ...args: any[]): void {
        const config = vscode.workspace.getConfiguration('codeguardian');
        if (config.get('debug.enableLogging', false)) {
            const timestamp = new Date().toISOString();
            const formattedMessage = `[${timestamp}] DEBUG: ${message}`;
            
            console.debug(formattedMessage, ...args);
            this.getOutputChannel().appendLine(formattedMessage + (args.length > 0 ? ' ' + JSON.stringify(args) : ''));
        }
    }

    static dispose(): void {
        if (this.outputChannel) {
            this.outputChannel.dispose();
            this.outputChannel = undefined;
        }
    }
}