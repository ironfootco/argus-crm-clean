export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = process.env.WAVE_FULL_ACCESS_TOKEN || process.env.WAVE_ACCESS_TOKEN;
  const rawBusinessId = process.env.WAVE_BUSINESS_ID || "QnVzaW5lc3M6ZjY0NTE4OGQtNGEzNi00OTY0LTlhZDItODNhYWUxZWNjNzBk";

  if (!token) return res.status(400).json({ error: 'Wave access token missing.' });
  const businessId = rawBusinessId.startsWith('Qn') ? rawBusinessId : btoa(`Business:${rawBusinessId}`);

  const formatPhone = (phoneStr) => {
    if (!phoneStr) return '';
    const digits = phoneStr.replace(/\D/g, '');
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
    }
    if (digits.length === 11 && digits.startsWith('1')) {
      return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 11)}`;
    }
    return phoneStr;
  };

  try {
    let allCustomers = [];
    let page = 1;
    let totalPages = 1;

    do {
      const response = await fetch('https://gql.waveapps.com/graphql/public', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: `
            query GetCustomers($biz: ID!, $page: Int!) {
              business(id: $biz) {
                customers(page: $page, pageSize: 50) {
                  pageInfo { currentPage totalPages }
                  edges {
                    node {
                      id
                      name
                      firstName
                      lastName
                      email
                      phone
                      address {
                        addressLine1
                        addressLine2
                        city
                        province { code }
                        postalCode
                      }
                    }
                  }
                }
              }
            }
          `,
          variables: { biz: businessId, page }
        })
      });

      const json = await response.json();
      if (json.errors) throw new Error(json.errors[0].message);

      const custData = json?.data?.business?.customers;
      if (!custData) break;

      totalPages = custData.pageInfo?.totalPages || 1;

      const cleaned = custData.edges.map(e => {
        const node = e.node;
        let fn = node.firstName || '';
        let ln = node.lastName || '';

        if (!fn && !ln && node.name) {
          const parts = node.name.trim().split(' ');
          fn = parts[0] || '';
          ln = parts.slice(1).join(' ') || '';
        }

        const addr = node.address || {};
        const fullAddr = [
          addr.addressLine1,
          addr.addressLine2,
          addr.city,
          addr.province?.code ? addr.province.code.replace('US-', '') : '',
          addr.postalCode
        ].filter(Boolean).join(', ');

        return {
          first_name: fn || 'Unnamed',
          last_name: ln || 'Client',
          email: node.email || '',
          phone: formatPhone(node.phone),
          address: fullAddr || ''
        };
      });

      allCustomers = [...allCustomers, ...cleaned];
      page++;
    } while (page <= totalPages);

    return res.status(200).json({ success: true, count: allCustomers.length, customers: allCustomers });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
