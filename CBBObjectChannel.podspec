Pod::Spec.new do |s|
  s.name = "CBBObjectChannel"
  s.version = "2.0.0"
  s.summary = "ObjectChannel for iOS"
  s.homepage = "https://github.com/cross-border-bridge/object-channel-ios"
  s.author = 'DWANGO Co., Ltd.'
  s.license = { :type => 'MIT', :file => 'LICENSE' }
  s.platform = :ios, "8.0"
  s.source = { :git => "https://github.com/cross-border-bridge/object-channel-ios.git", :tag => "#{s.version}" }
  s.source_files = "CBBObjectChannel/**/*.{h,m}"
  s.dependency "CBBFunctionChannel"
end
