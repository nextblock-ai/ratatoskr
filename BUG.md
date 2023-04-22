✔ Enter your instruction: · update the main run loop so that instead of exiting out after processing a 
user command (if the app was started with command but one was entered in the app) the app instead repeats 
its process of gathering user input to run another command. The app should remain running when invoked 
with no task. Only when a task is passed on the command line should puck run once to fulfill the task. In 
all other cases the app should continue to run

AI Response: !patch runpuck.ts "
--- runpuck.ts
+++ runpuck.ts
@@ -4,8 +4,19 @@
 
 async function main() {
     // Replace 'your-api-key' with your actual API key
     const puck = new Puck(process.env.OPENAI_KEY || '');
-    await puck.run();
+    
+    if (process.argv.length > 2) {
+        // Run the task passed on the command line
+        await puck.run(process.argv[2]);
+    } else {
+        // Keep running and gathering user input
+        while (true) {
+            const userInput = await puck.getUserInput();
+            if (userInput) {
+                await puck.run(userInput);
+            }
+        }
+    }
