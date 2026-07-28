{
  "$schema": "./node_modules/@angular/cli/lib/config/schema.json",
  "version": 1,
  "newProjectRoot": "projects",
  "projects": {
    "mco-front": {
      "projectType": "application",
      "root": "",
      "sourceRoot": "src",
      "prefix": "mco",
      "architect": {
        "build": {
          "builder": "@angular-devkit/build-angular:application",
          "options": {
            "outputPath": { "base": "dist", "browser": "" },
            "index": "src/index.html",
            "browser": "src/main.ts",
            "polyfills": ["zone.js"],
            "tsConfig": "tsconfig.app.json",
            "assets": [],
            "styles": ["src/styles.css"],
            "scripts": []
          },
          "configurations": {
            "production": {
              "optimization": {
                "scripts": true,
                "styles": true,
                "fonts": { "inline": false }
              },
              "budgets": [
                { "type": "initial", "maximumWarning": "1200kB", "maximumError": "2mb" },
                { "type": "anyComponentStyle", "maximumWarning": "40kB", "maximumError": "80kB" }
              ],
              "outputHashing": "all"
            },
            "development": { "optimization": false, "sourceMap": true }
          },
          "defaultConfiguration": "production"
        },
        "serve": {
          "builder": "@angular-devkit/build-angular:dev-server",
          "configurations": {
            "production": { "buildTarget": "mco-front:build:production" },
            "development": { "buildTarget": "mco-front:build:development" }
          },
          "defaultConfiguration": "development",
          "options": { "port": 4200 }
        }
      }
    }
  }
}
