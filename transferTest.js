// transferTest.js
fetch('http://localhost:5002/api/wallet/transfer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fromAccountNumber: 'VP6747232524',
      toAccountNumber: 'AP9854908866',
      amount: 10000,
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
  