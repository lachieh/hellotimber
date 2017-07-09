const webpack = require('webpack');
const path = require('path');
const ExtractTextPlugin = require('extract-text-webpack-plugin');

const extractSass = new ExtractTextPlugin({
    filename: "[name].css",
});

module.exports = {
  entry: {
    'css/app': [
      path.resolve(__dirname, 'app/styles/app.scss')
    ],
		'js/app': [
			path.resolve(__dirname, 'app/js/app.js')
		]
  },

  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js'
  },

  watch: true,

  module: {
    rules: [
      {
			  test: /\.js$/,
			  exclude: /node_modules\/*/,
			  use: {
					loader: 'babel-loader',
			  	options: {
				    presets: [
				      ['es2015']
				    ]
				  }
				}
      },

			{
        test: /\.scss$/,
				use: extractSass.extract({
          use: [{
            loader: "css-loader"
          }, {
            loader: "postcss-loader",
						options: {
							plugins: (loader) => [
					      require('autoprefixer')()
					    ]
						}
          }, {
            loader: "sass-loader"
          }],
          fallback: "style-loader"
        })
      }
    ],
  },
  devtool: "source-map",
  devServer: {
	  contentBase: path.join(__dirname, "dist"),
	  compress: true,
	  port: 9000
  },

  plugins: [
		extractSass
	],
}
