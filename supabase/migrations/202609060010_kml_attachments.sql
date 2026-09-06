-- Preserve existing bucket limits and privacy while allowing original KML archives.
update storage.buckets
set allowed_mime_types = array_append(allowed_mime_types, 'application/vnd.google-earth.kml+xml')
where id = 'aerolog-files'
  and allowed_mime_types is not null
  and not ('application/vnd.google-earth.kml+xml' = any(allowed_mime_types));
