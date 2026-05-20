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
      /* dangerouslySetInnerHTML keeps Next from double-escaping the
         JSON. .replace() escapes "<" to < so a string value
         containing "</script>" can't break out of the <script>
         block (XSS); < is valid JSON — crawlers still parse it. */
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
