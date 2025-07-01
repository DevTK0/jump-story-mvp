import fs from 'fs';
import path from 'path';

function clearDownloadsFolder(): void {
  const downloadsDir = path.join(process.cwd(), 'downloads');
  
  console.log('Clearing downloads folder...');
  
  if (!fs.existsSync(downloadsDir)) {
    console.log('Downloads folder does not exist. Nothing to clear.');
    return;
  }
  
  try {
    const files = fs.readdirSync(downloadsDir);
    
    if (files.length === 0) {
      console.log('Downloads folder is already empty.');
      return;
    }
    
    console.log(`Found ${files.length} files to delete:`);
    
    files.forEach(file => {
      const filePath = path.join(downloadsDir, file);
      const stats = fs.statSync(filePath);
      
      if (stats.isFile()) {
        fs.unlinkSync(filePath);
        console.log(`  ✓ Deleted: ${file}`);
      } else if (stats.isDirectory()) {
        fs.rmSync(filePath, { recursive: true, force: true });
        console.log(`  ✓ Deleted directory: ${file}`);
      }
    });
    
    console.log(`\n✅ Successfully cleared ${files.length} items from downloads folder.`);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Error clearing downloads folder:', errorMessage);
  }
}

function clearRootLogFiles(): void {
  const currentDir = process.cwd();
  const logPatterns: RegExp[] = [
    /.*\.png$/,
    /.*\.webm$/,
    /.*\.json$/,
    /movement-log.*\.json$/,
    /movement-analysis.*\.json$/,
    /game-test-recording.*\.webm$/
  ];
  
  console.log('\nCleaning up any log files in root directory...');
  
  try {
    const files = fs.readdirSync(currentDir);
    const logFiles = files.filter(file => {
      return logPatterns.some(pattern => pattern.test(file)) && 
             !['package.json', 'tsconfig.json', 'vite.config.ts', '.mcp.json'].includes(file);
    });
    
    if (logFiles.length === 0) {
      console.log('No log files found in root directory.');
      return;
    }
    
    console.log(`Found ${logFiles.length} log files in root:`);
    
    logFiles.forEach(file => {
      const filePath = path.join(currentDir, file);
      fs.unlinkSync(filePath);
      console.log(`  ✓ Deleted: ${file}`);
    });
    
    console.log(`\n✅ Successfully cleared ${logFiles.length} log files from root directory.`);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Error clearing root log files:', errorMessage);
  }
}

function main(): void {
  console.log('🧹 Starting cleanup process...\n');
  
  clearDownloadsFolder();
  clearRootLogFiles();
  
  console.log('\n🎉 Cleanup completed!');
}

main();