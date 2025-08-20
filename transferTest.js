// transferTest.js
fetch('http://localhost:5001/api/wallet/transfer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fromAccountNumber: 'VP2795188128',
      toAccountNumber: 'BP3907799941',
      amount: 5000,
      orderId: 'ORDER567',
    }),
  })
    .then(res => res.json())
    .then(data => {
      console.log('✅ Transfer response:', data);
    })
    .catch(err => {
      console.error('❌ Error making transfer:', err);
    });
  