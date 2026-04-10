export type LoggerLevel = 'query' | 'error'

export const ipcLogger = ({ content, cUid, level }: {content: string; cUid: string; level: LoggerLevel}) => {
   if (level === 'error') {
      console.error(`[${cUid}] ${content}`);
   }
   else if (level === 'query') {
      const escapedSql = content.replace(/(\/\*(.|[\r\n])*?\*\/)|(--(.*|[\r\n]))/gm, '').replace(/\s\s+/g, ' ');
      if (process.env.NODE_ENV === 'development') console.log(`[${cUid}] ${escapedSql}`);
   }
};
