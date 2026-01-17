exports.handler = async (event, context) => {
  // CORS headers for all responses
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Parse form data from request
    const formData = JSON.parse(event.body);
    
    // Pesapal configuration from environment variables
    const PESAPAL_CONFIG = {
      consumerKey: process.env.PESAPAL_CONSUMER_KEY,
      consumerSecret: process.env.PESAPAL_CONSUMER_SECRET,
      baseUrl: process.env.PESAPAL_BASE_URL,
      ipnId: process.env.PESAPAL_IPN_ID
    };

    // Step 1: Authenticate with Pesapal
    const authResponse = await fetch(`${PESAPAL_CONFIG.baseUrl}/api/Auth/RequestToken`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        consumer_key: PESAPAL_CONFIG.consumerKey,
        consumer_secret: PESAPAL_CONFIG.consumerSecret
      })
    });

    const authData = await authResponse.json();
    
    if (!authData.token) {
      throw new Error('Failed to get authentication token');
    }

    // Step 2: Create payment order
    const orderData = {
      id: formData.orderReference,
      currency: 'USD',
      amount: formData.amount,
      description: formData.description,
      callback_url: formData.callbackUrl,
      notification_id: PESAPAL_CONFIG.ipnId,
      billing_address: {
        email_address: formData.email,
        phone_number: formData.phone,
        country_code: '',
        first_name: formData.firstName,
        last_name: formData.lastName,
        line_1: '',
        line_2: '',
        city: '',
        state: '',
        postal_code: '',
        zip_code: ''
      }
    };

    const orderResponse = await fetch(`${PESAPAL_CONFIG.baseUrl}/api/Transactions/SubmitOrderRequest`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authData.token}`
      },
      body: JSON.stringify(orderData)
    });

    const orderResult = await orderResponse.json();

    if (!orderResult.redirect_url) {
      throw new Error(orderResult.error?.message || 'Failed to create order');
    }

    // Step 3: Return success with redirect URL
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        redirectUrl: orderResult.redirect_url,
        orderTrackingId: orderResult.order_tracking_id
      })
    };

  } catch (error) {
    console.error('Payment proxy error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Payment processing failed'
      })
    };
  }
};
