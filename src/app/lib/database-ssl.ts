import fs from "fs";
import path from "path";
export type DatabaseSSLConfig =
  | false
  | {
      rejectUnauthorized: boolean;
      ca?: string;
    };

const useSSL = process.env.NODE_ENV === "production" && (process.env.DATABASE_URL || process.env.DATABASE_SSL === "true");
let sslConfig: DatabaseSSLConfig = false;

if (useSSL) {
  const config: Exclude<DatabaseSSLConfig, false> = {
    rejectUnauthorized: true,
  };

  // Environment Variable
  if (process.env.DATABASE_CA_CERT) {
    console.log("[Database] Using DATABASE_CA_CERT: ", process.env.DATABASE_CA_CERT);

    config.ca = process.env.DATABASE_CA_CERT.replace(/\\n/g, "\n");
  } else {
    // Local certificate
    const certificateLocations = [
      path.resolve(process.cwd(), "ca.pem"),
      path.resolve(process.cwd(), "certs/ca.pem"),
    ];

    const certificate = certificateLocations.find((location) =>
      fs.existsSync(location)
    );

    if (certificate) {
      console.log(`[Database] Using CA Certificate: ${certificate}`);

      config.ca = fs.readFileSync(certificate, "utf8");
    } else {
      console.warn(
        "[Database] DATABASE_SSL=true but no CA certificate was found."
      );
    }
  }

  sslConfig = config;
}

export default sslConfig;