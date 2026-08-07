export default async function handler(req, res) {
  const token = process.env.WAVE_ACCESS_TOKEN;
  const rawBusinessId = process.env.WAVE_BUSINESS_ID || "QnVzaW5lc3M6ZjY0NTE4OGQtNGEzNi00OTY0LTlhZDItODNhYWUxZWNjNzBk";

  let businessId = rawBusinessId;
  if (!businessId.startsWith('Qn')) {
    businessId = btoa(`Business:${rawBusinessId}`);
  }

  const query = {
    query: `
      query($businessId: ID!) {
        business(id: $businessId) {
          customers(page: 1, pageSize: 5) {
            edges {
              node {
                id
                name
                email
                phone
                mobile
                address {
                  addressLine1
                  addressLine2
                  city
                  province {
                    code
                    name
                  }
                  country {
                    code
                    name
                  }
                  postalCode
                }
              }
            }
          }
        }
      }
    `,
    variables: { businessId }
  };

  try {
    const response = await fetch('https://gql.waveapps.com/graphql/public', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(query)
    });

    const data = await response.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
