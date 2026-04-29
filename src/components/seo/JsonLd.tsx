/* Inline JSON-LD <script> injector. Server-renders the structured-
   data payload Google + other crawlers parse. Use sparingly — prefer
   one composite script per page over many small ones. */

interface Props {
  data: Record<string, unknown> | Array<Record<string, unknown>>;
}

export default function JsonLd({ data }: Props) {
  return (
    <script
      type="application/ld+json"
      /* dangerouslySetInnerHTML keeps Next from JSON-escaping the
         content twice — Google parses the verbatim JSON. */
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
