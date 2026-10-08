const { Keypair } = require('@stellar/stellar-sdk');

async function generateAndFund() {
  const account = Keypair.random();
  const publicKey = account.publicKey();
  const secret = account.secret();
  
  console.log(`Funding ${publicKey}...`);
  const response = await fetch(`https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`);
  if (response.ok) {
    console.log(`Funded!`);
  } else {
    console.log(`Failed to fund: ${await response.text()}`);
  }
  return { publicKey, secret };
}

async function run() {
  console.log("Merchant Account:");
  const merchant = await generateAndFund();
  console.log(`Public: ${merchant.publicKey}\nSecret: ${merchant.secret}\n`);
  
  console.log("Subscriber Account:");
  const subscriber = await generateAndFund();
  console.log(`Public: ${subscriber.publicKey}\nSecret: ${subscriber.secret}\n`);
  
  console.log("Executor Account:");
  const executor = await generateAndFund();
  console.log(`Public: ${executor.publicKey}\nSecret: ${executor.secret}\n`);
}

run();
