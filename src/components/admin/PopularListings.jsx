import { useEffect, useState } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, where, documentId, getDocs } from 'firebase/firestore';

export default function PopularListings({ events }) {
  const [names, setNames] = useState({});

  const counts = {};
  events.forEach(e => {
    if (e.listing_id) {
      counts[e.listing_id] = (counts[e.listing_id] || 0) + 1;
    }
  });

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const ids = sorted.map(([id]) => Number(id));

  useEffect(() => {
    if (ids.length === 0) {
      return;
    }
    const q = query(
      collection(db, 'companions'),
      where(documentId(), 'in', ids.map(String))
    );

    getDocs(q).then((snapshot) => {
      const map = {};
      snapshot.docs.forEach(doc => {
        map[doc.id] = doc.data().name;
      });
      setNames(map);
    }).catch(console.error);
  }, [ids]);

  if (sorted.length === 0) return <p style={{ color: '#94a3b8', fontSize: 13 }}>No listing clicks yet</p>;

  return (
    <table className="admin-table">
      <thead>
        <tr><th>Listing</th><th>Clicks</th></tr>
      </thead>
      <tbody>
        {sorted.map(([id, count]) => (
          <tr key={id}>
            <td>{names[id] || `#${id}`}</td>
            <td>{count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
